import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../lib/AppError';
import {
  resolveInstrumentIds,
  scopeOrClause,
  serializeRows,
  type HistoryScope,
} from './historyService';
import type {
  BankAccount,
  SearchCardItem,
  SearchManagerItem,
  SearchResults,
  TransactionHistoryItem,
  User,
} from '@banking-simulator/shared-types';

export type SearchRole = 'customer' | 'account_manager' | 'admin';

export interface SearchScope {
  role: SearchRole;
  // null = no restriction (admin, system-wide)
  customerIds: string[] | null;
}

export async function resolveSearchScope(user: { id: string; role: SearchRole }): Promise<SearchScope> {
  if (user.role === 'customer') return { role: 'customer', customerIds: [user.id] };
  if (user.role === 'account_manager') {
    const assignments = await prisma.customerAssignment.findMany({
      where: { accountManagerId: user.id },
      select: { customerId: true },
    });
    return { role: 'account_manager', customerIds: assignments.map((a) => a.customerId) };
  }
  return { role: 'admin', customerIds: null };
}

export function parseSearchQuery(raw: unknown): string {
  const q = typeof raw === 'string' ? raw.trim() : '';
  if (q.length < 2) {
    throw new AppError(400, 'Search query must be at least 2 characters', 'QUERY_TOO_SHORT');
  }
  return q;
}

interface PaginatedGroup<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function paginate<T>(all: T[], page: number, limit: number): PaginatedGroup<T> {
  const total = all.length;
  const start = (page - 1) * limit;
  return {
    data: all.slice(start, start + limit),
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function emptyGroup<T>(page: number, limit: number): PaginatedGroup<T> {
  return { data: [], total: 0, page, limit, totalPages: 0 };
}

const ACCOUNT_TYPES = ['savings', 'current'] as const;
const CARD_STATUSES = ['active', 'frozen', 'closed'] as const;
const TRANSACTION_TYPES = ['deposit', 'transfer', 'transfer_external', 'topup', 'spend', 'withdrawal'] as const;

function stripSpaces(q: string): string {
  return q.replace(/\s+/g, '');
}

// ─── Accounts ───────────────────────────────────────────────────────────────
function accountsWhere(scope: SearchScope, q: string): Prisma.BankAccountWhereInput {
  const ibanQuery = stripSpaces(q);
  const lower = q.toLowerCase();
  const typeMatches = ACCOUNT_TYPES.filter((t) => t.includes(lower));
  const statusMatches = CARD_STATUSES.filter((s) => s.includes(lower));

  const and: Prisma.BankAccountWhereInput[] = [];
  if (scope.customerIds !== null) and.push({ customerId: { in: scope.customerIds } });

  and.push({
    OR: [
      { iban: { contains: ibanQuery } },
      ...(typeMatches.length ? [{ type: { in: [...typeMatches] } }] : []),
      ...(statusMatches.length ? [{ status: { in: [...statusMatches] } }] : []),
    ],
  });

  return { AND: and };
}

function toBankAccount(a: {
  id: string;
  customerId: string;
  iban: string;
  type: string;
  status: string;
  balance: Prisma.Decimal;
  createdAt: Date;
}): BankAccount {
  return {
    id: a.id,
    customerId: a.customerId,
    iban: a.iban,
    type: a.type as BankAccount['type'],
    status: a.status as BankAccount['status'],
    balance: a.balance.toString(),
    createdAt: a.createdAt.toISOString(),
  };
}

async function searchAccountsPage(scope: SearchScope, q: string, page: number, limit: number) {
  const where = accountsWhere(scope, q);
  const [total, rows] = await Promise.all([
    prisma.bankAccount.count({ where }),
    prisma.bankAccount.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { data: rows.map(toBankAccount), total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
}

async function searchAccountsAll(scope: SearchScope, q: string): Promise<BankAccount[]> {
  const rows = await prisma.bankAccount.findMany({ where: accountsWhere(scope, q), orderBy: { createdAt: 'desc' } });
  return rows.map(toBankAccount);
}

// ─── Cards (debit + credit merged) ───────────────────────────────────────────
function debitCardsWhere(scope: SearchScope, q: string): Prisma.DebitCardWhereInput {
  const ibanQuery = stripSpaces(q);
  const lower = q.toLowerCase();
  const statusMatches = CARD_STATUSES.filter((s) => s.includes(lower));

  const and: Prisma.DebitCardWhereInput[] = [];
  if (scope.customerIds !== null) and.push({ customerId: { in: scope.customerIds } });

  const or: Prisma.DebitCardWhereInput[] = [
    { bankAccount: { iban: { contains: ibanQuery } } },
  ];
  if (statusMatches.length) or.push({ status: { in: [...statusMatches] } });
  if ('debit card'.includes(lower) || lower.includes('debit')) or.push({});

  and.push({ OR: or });
  return { AND: and };
}

function creditCardsWhere(scope: SearchScope, q: string): Prisma.CreditCardWhereInput {
  const lower = q.toLowerCase();
  const statusMatches = CARD_STATUSES.filter((s) => s.includes(lower));

  const and: Prisma.CreditCardWhereInput[] = [];
  if (scope.customerIds !== null) and.push({ customerId: { in: scope.customerIds } });

  const or: Prisma.CreditCardWhereInput[] = [];
  if (statusMatches.length) or.push({ status: { in: [...statusMatches] } });
  if ('credit card'.includes(lower) || lower.includes('credit')) or.push({});
  // No text signal at all matched anything card-specific — fall back to no match.
  and.push({ OR: or.length ? or : [{ id: 'never-matches' }] });

  return { AND: and };
}

function toSearchCardItem(
  c:
    | { kind: 'debit'; id: string; customerId: string; status: string; createdAt: Date; iban: string }
    | {
        kind: 'credit';
        id: string;
        customerId: string;
        status: string;
        createdAt: Date;
        creditLimit: Prisma.Decimal;
        outstandingBalance: Prisma.Decimal;
      },
): SearchCardItem {
  if (c.kind === 'debit') {
    return {
      id: c.id,
      cardType: 'debit',
      customerId: c.customerId,
      status: c.status as SearchCardItem['status'],
      iban: c.iban,
      creditLimit: null,
      outstandingBalance: null,
      createdAt: c.createdAt.toISOString(),
    };
  }
  return {
    id: c.id,
    cardType: 'credit',
    customerId: c.customerId,
    status: c.status as SearchCardItem['status'],
    iban: null,
    creditLimit: c.creditLimit.toString(),
    outstandingBalance: c.outstandingBalance.toString(),
    createdAt: c.createdAt.toISOString(),
  };
}

async function fetchMatchingCards(scope: SearchScope, q: string): Promise<SearchCardItem[]> {
  const [debitCards, creditCards] = await Promise.all([
    prisma.debitCard.findMany({ where: debitCardsWhere(scope, q), include: { bankAccount: true } }),
    prisma.creditCard.findMany({ where: creditCardsWhere(scope, q) }),
  ]);

  const merged = [
    ...debitCards.map((d) =>
      toSearchCardItem({
        kind: 'debit',
        id: d.id,
        customerId: d.customerId,
        status: d.status,
        createdAt: d.createdAt,
        iban: d.bankAccount.iban,
      }),
    ),
    ...creditCards.map((c) =>
      toSearchCardItem({
        kind: 'credit',
        id: c.id,
        customerId: c.customerId,
        status: c.status,
        createdAt: c.createdAt,
        creditLimit: c.creditLimit,
        outstandingBalance: c.outstandingBalance,
      }),
    ),
  ];

  merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return merged;
}

async function searchCardsPage(scope: SearchScope, q: string, page: number, limit: number) {
  const all = await fetchMatchingCards(scope, q);
  return paginate(all, page, limit);
}

async function searchCardsAll(scope: SearchScope, q: string): Promise<SearchCardItem[]> {
  return fetchMatchingCards(scope, q);
}

// ─── Transactions ─────────────────────────────────────────────────────────────
async function resolveTransactionInstrumentScope(scope: SearchScope): Promise<HistoryScope | null> {
  return scope.customerIds === null ? null : resolveInstrumentIds(scope.customerIds);
}

function transactionsTextWhere(q: string): Prisma.TransactionWhereInput {
  const ibanQuery = stripSpaces(q);
  const lower = q.toLowerCase();
  const typeMatches = TRANSACTION_TYPES.filter((t) => t.replace('_', ' ').includes(lower) || t.includes(lower));

  return {
    OR: [
      { description: { contains: q } },
      ...(typeMatches.length ? [{ type: { in: [...typeMatches] } }] : []),
      { fromAccount: { iban: { contains: ibanQuery } } },
      { toAccount: { iban: { contains: ibanQuery } } },
    ],
  };
}

async function searchTransactionsPage(scope: SearchScope, q: string, page: number, limit: number) {
  const instrumentScope = await resolveTransactionInstrumentScope(scope);
  const where: Prisma.TransactionWhereInput = {
    AND: [instrumentScope ? scopeOrClause(instrumentScope) : {}, transactionsTextWhere(q)],
  };

  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);

  const data: TransactionHistoryItem[] = await serializeRows(rows, instrumentScope);
  return { data, total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
}

async function searchTransactionsAll(scope: SearchScope, q: string): Promise<TransactionHistoryItem[]> {
  const instrumentScope = await resolveTransactionInstrumentScope(scope);
  const where: Prisma.TransactionWhereInput = {
    AND: [instrumentScope ? scopeOrClause(instrumentScope) : {}, transactionsTextWhere(q)],
  };
  const rows = await prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' } });
  return serializeRows(rows, instrumentScope);
}

// ─── Users (customers only) ──────────────────────────────────────────────────
function usersWhere(scope: SearchScope, q: string): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [{ role: 'customer' }];
  if (scope.customerIds !== null) and.push({ id: { in: scope.customerIds } });
  and.push({
    OR: [
      { fullName: { contains: q } },
      { username: { contains: q } },
    ],
  });
  return { AND: and };
}

function toUser(u: { id: string; username: string; role: string; fullName: string; createdAt: Date }): User {
  return {
    id: u.id,
    username: u.username,
    role: u.role as User['role'],
    fullName: u.fullName,
    createdAt: u.createdAt.toISOString(),
  };
}

async function searchUsersPage(scope: SearchScope, q: string, page: number, limit: number) {
  const where = usersWhere(scope, q);
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { data: rows.map(toUser), total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
}

async function searchUsersAll(scope: SearchScope, q: string): Promise<User[]> {
  const rows = await prisma.user.findMany({ where: usersWhere(scope, q), orderBy: { createdAt: 'desc' } });
  return rows.map(toUser);
}

// ─── Managers (admin scope only) ─────────────────────────────────────────────
function managersWhere(q: string): Prisma.UserWhereInput {
  return {
    AND: [
      { role: 'account_manager' },
      {
        OR: [
          { fullName: { contains: q } },
          { username: { contains: q } },
        ],
      },
    ],
  };
}

function toSearchManagerItem(m: {
  id: string;
  username: string;
  role: string;
  fullName: string;
  createdAt: Date;
  managerAssignments: unknown[];
}): SearchManagerItem {
  return { ...toUser(m), clientCount: m.managerAssignments.length };
}

async function searchManagersPage(q: string, page: number, limit: number) {
  const where = managersWhere(q);
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { managerAssignments: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return {
    data: rows.map(toSearchManagerItem),
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

async function searchManagersAll(q: string): Promise<SearchManagerItem[]> {
  const rows = await prisma.user.findMany({
    where: managersWhere(q),
    include: { managerAssignments: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toSearchManagerItem);
}

// ─── Orchestration ────────────────────────────────────────────────────────────
export async function querySearchPage(
  scope: SearchScope,
  q: string,
  page: number,
  limit: number,
): Promise<SearchResults> {
  const [accounts, cards, transactions] = await Promise.all([
    searchAccountsPage(scope, q, page, limit),
    searchCardsPage(scope, q, page, limit),
    searchTransactionsPage(scope, q, page, limit),
  ]);

  const users = scope.role === 'customer' ? emptyGroup<User>(page, limit) : await searchUsersPage(scope, q, page, limit);
  const managers = scope.role === 'admin' ? await searchManagersPage(q, page, limit) : emptyGroup<SearchManagerItem>(page, limit);

  return { accounts, cards, transactions, users, managers };
}

export interface SearchExportData {
  accounts: BankAccount[];
  cards: SearchCardItem[];
  transactions: TransactionHistoryItem[];
  users: User[];
  managers: SearchManagerItem[];
}

export async function querySearchAll(scope: SearchScope, q: string): Promise<SearchExportData> {
  const [accounts, cards, transactions] = await Promise.all([
    searchAccountsAll(scope, q),
    searchCardsAll(scope, q),
    searchTransactionsAll(scope, q),
  ]);

  const users = scope.role === 'customer' ? [] : await searchUsersAll(scope, q);
  const managers = scope.role === 'admin' ? await searchManagersAll(q) : [];

  return { accounts, cards, transactions, users, managers };
}
