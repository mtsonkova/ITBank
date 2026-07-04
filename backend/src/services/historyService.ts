import { Prisma, TransactionType, AccountType, type Transaction as TransactionRow } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../lib/AppError';
import type { InstrumentRef, TransactionHistoryItem } from '@banking-simulator/shared-types';

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

export interface HistoryScope {
  accountIds: string[];
  debitCardIds: string[];
  creditCardIds: string[];
}

export interface HistoryFilters {
  scope: HistoryScope | null; // null = no restriction (system-wide admin view)
  from?: string;
  to?: string;
  type?: string;
  accountId?: string;
  cardId?: string;
}

// ─── Scope resolution ──────────────────────────────────────────────────────────
export async function resolveInstrumentIds(customerIds: string[]): Promise<HistoryScope> {
  if (customerIds.length === 0) return { accountIds: [], debitCardIds: [], creditCardIds: [] };

  const [accounts, debitCards, creditCards] = await Promise.all([
    prisma.bankAccount.findMany({ where: { customerId: { in: customerIds } }, select: { id: true } }),
    prisma.debitCard.findMany({ where: { customerId: { in: customerIds } }, select: { id: true } }),
    prisma.creditCard.findMany({ where: { customerId: { in: customerIds } }, select: { id: true } }),
  ]);

  return {
    accountIds: accounts.map((a) => a.id),
    debitCardIds: debitCards.map((c) => c.id),
    creditCardIds: creditCards.map((c) => c.id),
  };
}

// ─── Query param parsing ───────────────────────────────────────────────────────
export function parsePage(raw: unknown): number {
  const n = parseInt(raw as string, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function parseLimit(raw: unknown): number {
  const n = parseInt(raw as string, 10);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

export function parseType(raw: unknown): TransactionType | undefined {
  if (!raw) return undefined;
  const valid = Object.values(TransactionType) as string[];
  if (!valid.includes(raw as string)) {
    throw new AppError(400, `type must be one of ${valid.join(', ')}`, 'INVALID_TYPE');
  }
  return raw as TransactionType;
}

function parseFromDate(raw: unknown): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw as string);
  if (Number.isNaN(d.getTime())) throw new AppError(400, 'Invalid "from" date', 'INVALID_DATE');
  return d;
}

function parseToDate(raw: unknown): Date | undefined {
  if (!raw) return undefined;
  const s = raw as string;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new AppError(400, 'Invalid "to" date', 'INVALID_DATE');
  if (!s.includes('T')) d.setUTCHours(23, 59, 59, 999);
  return d;
}

// ─── WHERE clause construction ─────────────────────────────────────────────────
export function scopeOrClause(scope: HistoryScope): Prisma.TransactionWhereInput {
  return {
    OR: [
      { fromAccountId: { in: scope.accountIds } },
      { toAccountId: { in: scope.accountIds } },
      { fromCardId: { in: scope.debitCardIds } },
      { debitCardId: { in: scope.debitCardIds } },
      { toCardId: { in: scope.creditCardIds } },
    ],
  };
}

function instrumentFilterClause(accountId?: string, cardId?: string): Prisma.TransactionWhereInput | null {
  if (!accountId && !cardId) return null;
  const or: Prisma.TransactionWhereInput[] = [];
  if (accountId) or.push({ fromAccountId: accountId }, { toAccountId: accountId });
  if (cardId) or.push({ fromCardId: cardId }, { debitCardId: cardId }, { toCardId: cardId });
  return { OR: or };
}

export function buildHistoryWhere(filters: {
  scope: HistoryScope | null;
  from?: unknown;
  to?: unknown;
  type?: TransactionType;
  accountId?: string;
  cardId?: string;
}): Prisma.TransactionWhereInput {
  const and: Prisma.TransactionWhereInput[] = [];

  if (filters.scope) and.push(scopeOrClause(filters.scope));

  const instrumentFilter = instrumentFilterClause(filters.accountId, filters.cardId);
  if (instrumentFilter) and.push(instrumentFilter);

  if (filters.type) and.push({ type: filters.type });

  const from = parseFromDate(filters.from);
  const to = parseToDate(filters.to);
  if (from || to) {
    and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  }

  return and.length > 0 ? { AND: and } : {};
}

// ─── Row serialization (labels + signed amount from the viewer's perspective) ──
export async function serializeRows(rows: TransactionRow[], scope: HistoryScope | null): Promise<TransactionHistoryItem[]> {
  const accountIds = new Set<string>();
  const debitCardIds = new Set<string>();
  const creditCardIds = new Set<string>();

  for (const r of rows) {
    if (r.fromAccountId) accountIds.add(r.fromAccountId);
    if (r.toAccountId) accountIds.add(r.toAccountId);
    if (r.fromCardId) debitCardIds.add(r.fromCardId);
    if (r.debitCardId) debitCardIds.add(r.debitCardId);
    if (r.toCardId) creditCardIds.add(r.toCardId);
  }

  const [accounts, debitCards, creditCards] = await Promise.all([
    accountIds.size
      ? prisma.bankAccount.findMany({ where: { id: { in: [...accountIds] } }, select: { id: true, iban: true, type: true } })
      : Promise.resolve([]),
    debitCardIds.size
      ? prisma.debitCard.findMany({ where: { id: { in: [...debitCardIds] } }, select: { id: true } })
      : Promise.resolve([]),
    creditCardIds.size
      ? prisma.creditCard.findMany({ where: { id: { in: [...creditCardIds] } }, select: { id: true } })
      : Promise.resolve([]),
  ]);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const debitCardIdSet = new Set(debitCards.map((c) => c.id));
  const creditCardIdSet = new Set(creditCards.map((c) => c.id));

  const scopeIds = scope ? new Set([...scope.accountIds, ...scope.debitCardIds, ...scope.creditCardIds]) : null;

  function accountRef(id: string | null): InstrumentRef | null {
    if (!id) return null;
    const a = accountMap.get(id);
    return { kind: 'account', id, iban: a?.iban ?? null, accountType: (a?.type as AccountType) ?? null };
  }
  function debitCardRef(id: string | null): InstrumentRef | null {
    if (!id || !debitCardIdSet.has(id)) return null;
    return { kind: 'debit_card', id, iban: null, accountType: null };
  }
  function creditCardRef(id: string | null): InstrumentRef | null {
    if (!id || !creditCardIdSet.has(id)) return null;
    return { kind: 'credit_card', id, iban: null, accountType: null };
  }

  return rows.map((r) => {
    let sign: 1 | -1;
    let instrument: InstrumentRef | null;
    let counterpart: InstrumentRef | null;

    if (r.type === 'deposit') {
      sign = 1;
      instrument = accountRef(r.toAccountId);
      counterpart = null;
    } else if (r.type === 'withdrawal') {
      sign = -1;
      instrument = accountRef(r.fromAccountId);
      counterpart = null;
    } else if (r.type === 'spend') {
      sign = -1;
      instrument = debitCardRef(r.debitCardId) ?? accountRef(r.fromAccountId) ?? creditCardRef(r.toCardId);
      counterpart = null;
    } else {
      // transfer / transfer_external / topup — a genuine two-sided movement
      const fromIds = [r.fromAccountId, r.fromCardId].filter((id): id is string => !!id);
      const fromInScope = !scopeIds || fromIds.some((id) => scopeIds.has(id));

      if (fromInScope) {
        sign = -1;
        instrument = debitCardRef(r.fromCardId) ?? accountRef(r.fromAccountId);
        counterpart = accountRef(r.toAccountId) ?? creditCardRef(r.toCardId);
      } else {
        sign = 1;
        instrument = accountRef(r.toAccountId) ?? creditCardRef(r.toCardId);
        counterpart = debitCardRef(r.fromCardId) ?? accountRef(r.fromAccountId);
      }
    }

    const amount = (sign * r.amount.toNumber()).toFixed(2);

    return {
      id: r.id,
      type: r.type,
      amount,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
      instrument,
      counterpart,
    };
  });
}

// ─── Public query functions ─────────────────────────────────────────────────────
export interface HistoryPage {
  data: TransactionHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function queryHistoryPage(
  filters: HistoryFilters & { page: number; limit: number },
): Promise<HistoryPage> {
  const type = parseType(filters.type);
  const where = buildHistoryWhere({ ...filters, type });

  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
  ]);

  const data = await serializeRows(rows, filters.scope);
  const totalPages = total === 0 ? 0 : Math.ceil(total / filters.limit);

  return { data, total, page: filters.page, limit: filters.limit, totalPages };
}

export async function queryHistoryAll(filters: HistoryFilters): Promise<TransactionHistoryItem[]> {
  const type = parseType(filters.type);
  const where = buildHistoryWhere({ ...filters, type });
  const rows = await prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' } });
  return serializeRows(rows, filters.scope);
}
