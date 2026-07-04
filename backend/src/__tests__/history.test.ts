import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

process.env.JWT_SECRET = 'test-secret-for-unit-tests';

// ─── Fixture data ───────────────────────────────────────────────────────────────
function decimal(value: number) {
  return { toNumber: () => value, toString: () => value.toFixed(2) };
}

const ACCOUNTS = [
  { id: 'acct-a1', customerId: 'cust-a', iban: 'IB12AAAA1111AAAA1111', type: 'savings' },
  { id: 'acct-b1', customerId: 'cust-b', iban: 'IB12BBBB1111BBBB1111', type: 'current' },
  { id: 'acct-c1', customerId: 'cust-c', iban: 'IB12CCCC1111CCCC1111', type: 'savings' },
  { id: 'acct-d1', customerId: 'cust-d', iban: 'IB12DDDD1111DDDD1111', type: 'savings' },
];
const DEBIT_CARDS: { id: string; customerId: string }[] = [];
const CREDIT_CARDS: { id: string; customerId: string }[] = [];

// tx-1: deposit into cust-a's account (+100)
// tx-2: transfer_external cust-a -> cust-b (-40 for A, +40 for B)
// tx-3: spend from cust-b's account (-15)
// tx-4: deposit into cust-c's account (+60) — cust-c belongs to a different manager
const TRANSACTIONS = [
  {
    id: 'tx-1',
    type: 'deposit',
    fromAccountId: null,
    toAccountId: 'acct-a1',
    fromCardId: null,
    toCardId: null,
    debitCardId: null,
    amount: decimal(100),
    description: null,
    createdAt: new Date('2026-01-05T10:00:00.000Z'),
  },
  {
    id: 'tx-2',
    type: 'transfer_external',
    fromAccountId: 'acct-a1',
    toAccountId: 'acct-b1',
    fromCardId: null,
    toCardId: null,
    debitCardId: null,
    amount: decimal(40),
    description: null,
    createdAt: new Date('2026-01-06T10:00:00.000Z'),
  },
  {
    id: 'tx-3',
    type: 'spend',
    fromAccountId: 'acct-b1',
    toAccountId: null,
    fromCardId: null,
    toCardId: null,
    debitCardId: null,
    amount: decimal(15),
    description: 'Groceries',
    createdAt: new Date('2026-01-07T10:00:00.000Z'),
  },
  {
    id: 'tx-4',
    type: 'deposit',
    fromAccountId: null,
    toAccountId: 'acct-c1',
    fromCardId: null,
    toCardId: null,
    debitCardId: null,
    amount: decimal(60),
    description: null,
    createdAt: new Date('2026-01-08T10:00:00.000Z'),
  },
  // 12 deposits for cust-d, isolated from the other fixtures above, used only
  // to exercise pagination math (total/page/limit/totalPages) without
  // perturbing the scoping assertions on cust-a/b/c.
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `tx-p${i + 1}`,
    type: 'deposit',
    fromAccountId: null,
    toAccountId: 'acct-d1',
    fromCardId: null,
    toCardId: null,
    debitCardId: null,
    amount: decimal(10),
    description: null,
    createdAt: new Date(`2026-02-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`),
  })),
];

const ASSIGNMENTS = [
  { customerId: 'cust-a', accountManagerId: 'mgr-1' },
  { customerId: 'cust-c', accountManagerId: 'mgr-2' },
];

// ─── Prisma mock: real filtering against fixtures, not just call assertions ────
function matchesWhere(tx: Record<string, unknown>, where: any): boolean {
  if (!where) return true;
  if (where.AND) return (where.AND as any[]).every((w) => matchesWhere(tx, w));
  if (where.OR) return (where.OR as any[]).some((w) => matchesWhere(tx, w));
  return Object.entries(where).every(([key, cond]: [string, any]) => {
    const value = (tx as any)[key];
    if (cond && typeof cond === 'object') {
      if ('in' in cond) return (cond.in as unknown[]).includes(value);
      if ('gte' in cond || 'lte' in cond) {
        if (cond.gte && value < cond.gte) return false;
        if (cond.lte && value > cond.lte) return false;
        return true;
      }
      return false;
    }
    return value === cond;
  });
}

vi.mock('../lib/prisma', () => ({
  default: {
    bankAccount: { findMany: vi.fn() },
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

  (prisma.bankAccount.findMany as any).mockImplementation(async ({ where }: any) => {
    const ids: string[] | undefined = where?.id?.in;
    const customerIds: string[] | undefined = where?.customerId?.in;
    return ACCOUNTS.filter(
      (a) => (!ids || ids.includes(a.id)) && (!customerIds || customerIds.includes(a.customerId)),
    );
  });
  (prisma.debitCard.findMany as any).mockImplementation(async ({ where }: any) => {
    const ids: string[] | undefined = where?.id?.in;
    const customerIds: string[] | undefined = where?.customerId?.in;
    return DEBIT_CARDS.filter(
      (c) => (!ids || ids.includes(c.id)) && (!customerIds || customerIds.includes(c.customerId)),
    );
  });
  (prisma.creditCard.findMany as any).mockImplementation(async ({ where }: any) => {
    const ids: string[] | undefined = where?.id?.in;
    const customerIds: string[] | undefined = where?.customerId?.in;
    return CREDIT_CARDS.filter(
      (c) => (!ids || ids.includes(c.id)) && (!customerIds || customerIds.includes(c.customerId)),
    );
  });
  (prisma.customerAssignment.findMany as any).mockImplementation(async ({ where }: any) => {
    return ASSIGNMENTS.filter((a) => a.accountManagerId === where.accountManagerId);
  });
  (prisma.transaction.count as any).mockImplementation(
    async ({ where }: any) => TRANSACTIONS.filter((t) => matchesWhere(t, where)).length,
  );
  (prisma.transaction.findMany as any).mockImplementation(async ({ where, skip = 0, take }: any) => {
    const filtered = TRANSACTIONS.filter((t) => matchesWhere(t, where)).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return take !== undefined ? filtered.slice(skip, skip + take) : filtered.slice(skip);
  });
});

// ─── Customer history ───────────────────────────────────────────────────────────
describe('GET /api/v1/transactions/history', () => {
  it("returns only the customer's own transactions", async () => {
    const res = await request(app)
      .get('/api/v1/transactions/history')
      .set('Authorization', `Bearer ${token('cust-a', 'customer')}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.map((d: any) => d.id).sort()).toEqual(['tx-1', 'tx-2']);
  });

  it('signs amounts and resolves instrument/counterpart from the viewer perspective', async () => {
    const res = await request(app)
      .get('/api/v1/transactions/history')
      .set('Authorization', `Bearer ${token('cust-a', 'customer')}`);

    const deposit = res.body.data.find((d: any) => d.id === 'tx-1');
    expect(deposit.amount).toBe('100.00');
    expect(deposit.instrument).toMatchObject({ kind: 'account', id: 'acct-a1' });
    expect(deposit.counterpart).toBeNull();

    const transferOut = res.body.data.find((d: any) => d.id === 'tx-2');
    expect(transferOut.amount).toBe('-40.00');
    expect(transferOut.instrument).toMatchObject({ kind: 'account', id: 'acct-a1' });
    expect(transferOut.counterpart).toMatchObject({ kind: 'account', id: 'acct-b1' });
  });

  it('shows the receiving side of a cross-customer transfer as a positive entry', async () => {
    const res = await request(app)
      .get('/api/v1/transactions/history')
      .set('Authorization', `Bearer ${token('cust-b', 'customer')}`);

    expect(res.body.total).toBe(2);
    const transferIn = res.body.data.find((d: any) => d.id === 'tx-2');
    expect(transferIn.amount).toBe('40.00');
    expect(transferIn.instrument).toMatchObject({ kind: 'account', id: 'acct-b1' });
    expect(transferIn.counterpart).toMatchObject({ kind: 'account', id: 'acct-a1' });

    const spend = res.body.data.find((d: any) => d.id === 'tx-3');
    expect(spend.amount).toBe('-15.00');
    expect(spend.counterpart).toBeNull();
    expect(spend.description).toBe('Groceries');
  });

  it('applies date filters correctly', async () => {
    const res = await request(app)
      .get('/api/v1/transactions/history')
      .query({ from: '2026-01-01', to: '2026-01-06' })
      .set('Authorization', `Bearer ${token('cust-a', 'customer')}`);

    expect(res.body.total).toBe(2);
    expect(res.body.data.map((d: any) => d.id).sort()).toEqual(['tx-1', 'tx-2']);
  });

  it('returns empty results for a customer with no transactions', async () => {
    const res = await request(app)
      .get('/api/v1/transactions/history')
      .set('Authorization', `Bearer ${token('cust-nobody', 'customer')}`);

    expect(res.body).toMatchObject({ data: [], total: 0 });
  });
});

// ─── Manager history ────────────────────────────────────────────────────────────
describe('GET /api/v1/manager/transactions/history', () => {
  it("returns only the manager's portfolio, not other managers' customers", async () => {
    const res = await request(app)
      .get('/api/v1/manager/transactions/history')
      .set('Authorization', `Bearer ${token('mgr-1', 'account_manager')}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.map((d: any) => d.id).sort()).toEqual(['tx-1', 'tx-2']);
  });

  it('returns 404 when customer_id is not in the manager portfolio', async () => {
    const res = await request(app)
      .get('/api/v1/manager/transactions/history')
      .query({ customer_id: 'cust-b' })
      .set('Authorization', `Bearer ${token('mgr-1', 'account_manager')}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ─── Admin history ──────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/transactions/history', () => {
  it('returns system-wide transactions when unfiltered', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions/history')
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.body.total).toBe(16);
  });

  it('scopes to a single customer via customer_id', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions/history')
      .query({ customer_id: 'cust-b' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.body.total).toBe(2);
    expect(res.body.data.map((d: any) => d.id).sort()).toEqual(['tx-2', 'tx-3']);
  });

  it("scopes to a manager's portfolio via manager_id", async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions/history')
      .query({ manager_id: 'mgr-1' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.body.total).toBe(2);
    expect(res.body.data.map((d: any) => d.id).sort()).toEqual(['tx-1', 'tx-2']);
  });

  it('paginates with correct total, page and limit', async () => {
    // cust-d has 12 fixture transactions, isolated from the rest — with limit=10
    // that's exactly 2 pages (10 + 2), which exercises real pagination math.
    const res = await request(app)
      .get('/api/v1/admin/transactions/history')
      .query({ customer_id: 'cust-d', page: 2, limit: 10 })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.body).toMatchObject({ total: 12, page: 2, limit: 10, totalPages: 2 });
    expect(res.body.data).toHaveLength(2);
  });

  it('filters by transaction type', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions/history')
      .query({ type: 'spend' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe('tx-3');
  });

  it('rejects an invalid type filter with 400', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions/history')
      .query({ type: 'not_a_real_type' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TYPE');
  });

  it('exports the filtered result set as a CSV file', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions/history')
      .query({ export: 'csv', manager_id: 'mgr-1' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('transaction-history.csv');
    expect(res.text).toContain('Type,Instrument,Amount,Counterpart,Date');
  });

  it('rejects an unknown export format with 400', async () => {
    const res = await request(app)
      .get('/api/v1/admin/transactions/history')
      .query({ export: 'docx' })
      .set('Authorization', `Bearer ${token('admin-1', 'admin')}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_EXPORT_FORMAT');
  });
});
