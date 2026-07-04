import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

process.env.JWT_SECRET = 'test-secret-for-unit-tests';

// ─── Fixture data ───────────────────────────────────────────────────────────────
function decimal(value: number) {
  return { toNumber: () => value, toString: () => value.toFixed(2) };
}

const USERS = [
  { id: 'cust-a', role: 'customer', fullName: 'Anna Becker', username: 'anna.becker', createdAt: new Date('2026-01-01') },
  { id: 'cust-b', role: 'customer', fullName: 'Boris Ivanov', username: 'boris.ivanov', createdAt: new Date('2026-01-02') },
  { id: 'cust-c', role: 'customer', fullName: 'Carla Diaz', username: 'carla.diaz', createdAt: new Date('2026-01-03') },
  { id: 'mgr-1', role: 'account_manager', fullName: 'Sofia Lang', username: 'sofia.lang', createdAt: new Date('2026-01-04') },
  { id: 'mgr-2', role: 'account_manager', fullName: 'Marco Rossi', username: 'marco.rossi', createdAt: new Date('2026-01-05') },
  { id: 'admin-1', role: 'admin', fullName: 'Michael Scott', username: 'michael.scott', createdAt: new Date('2026-01-06') },
];

const ASSIGNMENTS = [
  { customerId: 'cust-a', accountManagerId: 'mgr-1' },
  { customerId: 'cust-b', accountManagerId: 'mgr-1' },
  { customerId: 'cust-c', accountManagerId: 'mgr-2' },
];

const ACCOUNTS = [
  { id: 'acct-a1', customerId: 'cust-a', iban: 'IB12AAAA1111AAAA1111', type: 'savings', status: 'active', balance: decimal(100), createdAt: new Date('2026-01-10') },
  { id: 'acct-b1', customerId: 'cust-b', iban: 'IB12BBBB1111BBBB1111', type: 'current', status: 'active', balance: decimal(200), createdAt: new Date('2026-01-11') },
  { id: 'acct-c1', customerId: 'cust-c', iban: 'IB12CCCC1111CCCC1111', type: 'savings', status: 'active', balance: decimal(300), createdAt: new Date('2026-01-12') },
];

const DEBIT_CARDS = [
  {
    id: 'debit-a1',
    customerId: 'cust-a',
    bankAccountId: 'acct-a1',
    status: 'active',
    createdAt: new Date('2026-01-13'),
    bankAccount: { iban: 'IB12AAAA1111AAAA1111' },
  },
];

const CREDIT_CARDS = [
  {
    id: 'credit-b1',
    customerId: 'cust-b',
    status: 'active',
    creditLimit: decimal(500),
    outstandingBalance: decimal(100),
    createdAt: new Date('2026-01-14'),
  },
];

// tx-1: deposit into cust-a's account
// tx-2: transfer_external cust-a -> cust-b
// tx-3: spend from cust-b's account, description "Groceries"
// tx-4: deposit into cust-c's account (different manager / out of mgr-1's portfolio)
const TRANSACTIONS = [
  {
    id: 'tx-1', type: 'deposit', fromAccountId: null, toAccountId: 'acct-a1', fromCardId: null, toCardId: null, debitCardId: null,
    amount: decimal(100), description: null, createdAt: new Date('2026-01-20'),
    fromAccount: null, toAccount: { iban: 'IB12AAAA1111AAAA1111' },
  },
  {
    id: 'tx-2', type: 'transfer_external', fromAccountId: 'acct-a1', toAccountId: 'acct-b1', fromCardId: null, toCardId: null, debitCardId: null,
    amount: decimal(40), description: null, createdAt: new Date('2026-01-21'),
    fromAccount: { iban: 'IB12AAAA1111AAAA1111' }, toAccount: { iban: 'IB12BBBB1111BBBB1111' },
  },
  {
    id: 'tx-3', type: 'spend', fromAccountId: 'acct-b1', toAccountId: null, fromCardId: null, toCardId: null, debitCardId: null,
    amount: decimal(15), description: 'Groceries', createdAt: new Date('2026-01-22'),
    fromAccount: { iban: 'IB12BBBB1111BBBB1111' }, toAccount: null,
  },
  {
    id: 'tx-4', type: 'deposit', fromAccountId: null, toAccountId: 'acct-c1', fromCardId: null, toCardId: null, debitCardId: null,
    amount: decimal(60), description: null, createdAt: new Date('2026-01-23'),
    fromAccount: null, toAccount: { iban: 'IB12CCCC1111CCCC1111' },
  },
];

// ─── Generic mock matcher: handles AND/OR, in/contains leaf conditions, and ────
// nested relation objects (pre-embedded on fixtures, e.g. tx.fromAccount.iban) ─
function matchesField(value: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== 'object') return value === cond;
  const c = cond as Record<string, unknown>;
  if ('in' in c) return (c.in as unknown[]).includes(value);
  if ('contains' in c) {
    if (value == null) return false;
    return String(value).toLowerCase().includes(String(c.contains).toLowerCase());
  }
  if ('gte' in c || 'lte' in c) {
    if (c.gte && value! < c.gte) return false;
    if (c.lte && value! > c.lte) return false;
    return true;
  }
  // nested relation/plain object, e.g. { iban: { contains, mode } }
  if (value == null || typeof value !== 'object') return false;
  return matchesWhere(value as Record<string, unknown>, c);
}

function matchesWhere(row: Record<string, unknown>, where: any): boolean {
  if (!where) return true;
  if (Array.isArray(where.AND)) return (where.AND as any[]).every((w) => matchesWhere(row, w));
  if (Array.isArray(where.OR)) return (where.OR as any[]).some((w) => matchesWhere(row, w));
  return Object.entries(where).every(([key, cond]) => matchesField(row[key], cond));
}

function applyPage<T>(rows: T[], skip?: number, take?: number): T[] {
  if (skip === undefined && take === undefined) return rows;
  return rows.slice(skip ?? 0, (skip ?? 0) + (take ?? rows.length));
}

vi.mock('../lib/prisma', () => ({
  default: {
    user: { findMany: vi.fn(), count: vi.fn() },
    bankAccount: { findMany: vi.fn(), count: vi.fn() },
    debitCard: { findMany: vi.fn() },
    creditCard: { findMany: vi.fn() },
    customerAssignment: { findMany: vi.fn() },
    transaction: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import app from '../app';
import prisma from '../lib/prisma';

const SECRET = process.env.JWT_SECRET!;

function token(sub: string, role: string): string {
  return jwt.sign({ sub, role, jti: randomUUID() }, SECRET, { expiresIn: '8h' });
}

beforeEach(() => {
  vi.clearAllMocks();

  (prisma.user.findMany as any).mockImplementation(async ({ where, skip, take }: any) => {
    const filtered = USERS.filter((u) => matchesWhere(u, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const withAssignments = filtered.map((u) => ({
      ...u,
      managerAssignments: ASSIGNMENTS.filter((a) => a.accountManagerId === u.id),
    }));
    return applyPage(withAssignments, skip, take);
  });
  (prisma.user.count as any).mockImplementation(async ({ where }: any) => USERS.filter((u) => matchesWhere(u, where)).length);

  (prisma.bankAccount.findMany as any).mockImplementation(async ({ where, skip, take }: any) => {
    const filtered = ACCOUNTS.filter((a) => matchesWhere(a, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return applyPage(filtered, skip, take);
  });
  (prisma.bankAccount.count as any).mockImplementation(async ({ where }: any) => ACCOUNTS.filter((a) => matchesWhere(a, where)).length);

  (prisma.debitCard.findMany as any).mockImplementation(async ({ where }: any) =>
    DEBIT_CARDS.filter((c) => matchesWhere(c, where)),
  );
  (prisma.creditCard.findMany as any).mockImplementation(async ({ where }: any) =>
    CREDIT_CARDS.filter((c) => matchesWhere(c, where)),
  );
  (prisma.customerAssignment.findMany as any).mockImplementation(async ({ where }: any) =>
    ASSIGNMENTS.filter((a) => a.accountManagerId === where.accountManagerId),
  );

  (prisma.transaction.count as any).mockImplementation(
    async ({ where }: any) => TRANSACTIONS.filter((t) => matchesWhere(t, where)).length,
  );
  (prisma.transaction.findMany as any).mockImplementation(async ({ where, skip, take }: any) => {
    const filtered = TRANSACTIONS.filter((t) => matchesWhere(t, where)).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return applyPage(filtered, skip, take);
  });
});

describe('GET /api/v1/search — validation', () => {
  it('rejects a query shorter than 2 characters with 400', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'a' })
      .set('Authorization', `Bearer ${token('cust-a', 'customer')}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('QUERY_TOO_SHORT');
  });

  it('rejects a missing query with 400', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .set('Authorization', `Bearer ${token('cust-a', 'customer')}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('QUERY_TOO_SHORT');
  });

  it('returns grouped empty arrays for a query with no matches', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'zzznomatch' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.accounts).toMatchObject({ data: [], total: 0 });
    expect(res.body.cards).toMatchObject({ data: [], total: 0 });
    expect(res.body.transactions).toMatchObject({ data: [], total: 0 });
    expect(res.body.users).toMatchObject({ data: [], total: 0 });
    expect(res.body.managers).toMatchObject({ data: [], total: 0 });
  });
});

describe('Customer search scope', () => {
  it("finds only the customer's own account by IBAN, not another customer's", async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'IB12AAAA' })
      .set('Authorization', `Bearer ${token('cust-a', 'customer')}`);

    expect(res.body.accounts.data.map((a: any) => a.id)).toEqual(['acct-a1']);

    const other = await request(app)
      .get('/api/v1/search')
      .query({ q: 'IB12BBBB' })
      .set('Authorization', `Bearer ${token('cust-a', 'customer')}`);
    expect(other.body.accounts.data).toEqual([]);
  });

  it('never returns a users or managers group, even when the query matches a real name', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'Becker' })
      .set('Authorization', `Bearer ${token('cust-a', 'customer')}`);

    expect(res.body.users.data).toEqual([]);
    expect(res.body.managers.data).toEqual([]);
  });

  it("finds only the customer's own transactions", async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'transfer' })
      .set('Authorization', `Bearer ${token('cust-a', 'customer')}`);

    expect(res.body.transactions.data.map((t: any) => t.id)).toEqual(['tx-2']);
  });

  it("finds only the customer's own cards", async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'debit' })
      .set('Authorization', `Bearer ${token('cust-b', 'customer')}`);

    expect(res.body.cards.data).toEqual([]);

    const own = await request(app)
      .get('/api/v1/search')
      .query({ q: 'debit' })
      .set('Authorization', `Bearer ${token('cust-a', 'customer')}`);
    expect(own.body.cards.data.map((c: any) => c.id)).toEqual(['debit-a1']);
  });
});

describe('Manager search scope', () => {
  it("finds a portfolio client by name but not another manager's client", async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'Ivanov' })
      .set('Authorization', `Bearer ${token('mgr-1', 'account_manager')}`);
    expect(res.body.users.data.map((u: any) => u.id)).toEqual(['cust-b']);

    const outOfPortfolio = await request(app)
      .get('/api/v1/search')
      .query({ q: 'Diaz' })
      .set('Authorization', `Bearer ${token('mgr-1', 'account_manager')}`);
    expect(outOfPortfolio.body.users.data).toEqual([]);
  });

  it('finds portfolio cards (debit) but never returns a managers group', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'debit' })
      .set('Authorization', `Bearer ${token('mgr-1', 'account_manager')}`);

    expect(res.body.cards.data.map((c: any) => c.id)).toEqual(['debit-a1']);
    expect(res.body.managers.data).toEqual([]);
  });

  it("limits transactions to the manager's portfolio", async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'deposit' })
      .set('Authorization', `Bearer ${token('mgr-1', 'account_manager')}`);

    expect(res.body.transactions.data.map((t: any) => t.id)).toEqual(['tx-1']);
  });
});

describe('Admin search scope', () => {
  it('finds any customer by name, system-wide', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'Diaz' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);
    expect(res.body.users.data.map((u: any) => u.id)).toEqual(['cust-c']);
  });

  it('finds managers by name with clientCount populated', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'Rossi' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);
    expect(res.body.managers.data).toMatchObject([{ id: 'mgr-2', clientCount: 1 }]);
  });

  it('finds cards of any type across all customers', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'credit' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);
    expect(res.body.cards.data.map((c: any) => c.id)).toEqual(['credit-b1']);
  });

  it('finds transactions system-wide', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'deposit' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);
    expect(res.body.transactions.data.map((t: any) => t.id).sort()).toEqual(['tx-1', 'tx-4']);
  });

  it('returns a per-group pagination envelope alongside the matched data', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'IB12' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.body.accounts).toMatchObject({ total: 3, page: 1, limit: 10, totalPages: 1 });
    expect(res.body.accounts.data).toHaveLength(3);
  });
});

describe('GET /api/v1/search?export=', () => {
  it('exports a combined file across non-empty sections', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'IB12', export: 'csv' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('search-results.csv');
    expect(res.text).toContain('Accounts');
  });

  it('rejects an unknown export format with 400', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .query({ q: 'IB12', export: 'docx' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_EXPORT_FORMAT');
  });
});
