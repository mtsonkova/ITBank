import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

process.env.JWT_SECRET = 'test-secret-for-unit-tests';

vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      delete: vi.fn(),
    },
    customerAssignment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    bankAccount: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    debitCard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    creditCard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    request: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import app from '../app';
import prisma from '../lib/prisma';

const SECRET = process.env.JWT_SECRET!;
const MANAGER_ID = 'mgr-1';

function makeManagerToken(): string {
  return jwt.sign({ sub: MANAGER_ID, role: 'account_manager', jti: randomUUID() }, SECRET, {
    expiresIn: '8h',
  });
}

function decimal(value: number) {
  return { toNumber: () => value, toString: () => value.toFixed(2) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /api/v1/manager/clients ─────────────────────────────────────────────
describe('POST /api/v1/manager/clients', () => {
  it('auto-assigns the newly created customer to the creating manager', async () => {
    (prisma.user.create as any).mockResolvedValue({
      id: 'cust-new',
      username: 'new.customer',
      fullName: 'New Customer',
      role: 'customer',
    });
    (prisma.customerAssignment.create as any).mockResolvedValue({});

    const res = await request(app)
      .post('/api/v1/manager/clients')
      .set('Authorization', `Bearer ${makeManagerToken()}`)
      .send({ fullName: 'New Customer', username: 'new.customer', password: 'Password123!' });

    expect(res.status).toBe(201);
    expect(prisma.customerAssignment.create).toHaveBeenCalledWith({
      data: { customerId: 'cust-new', accountManagerId: MANAGER_ID },
    });
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/manager/clients')
      .set('Authorization', `Bearer ${makeManagerToken()}`)
      .send({ username: 'new.customer' });

    expect(res.status).toBe(400);
  });
});

// ─── Portfolio scoping ──────────────────────────────────────────────────────
describe('GET /api/v1/manager/clients/:customerId — portfolio scoping', () => {
  it('returns 403 for a client outside the manager portfolio', async () => {
    (prisma.customerAssignment.findUnique as any).mockResolvedValue({
      customerId: 'cust-1',
      accountManagerId: 'other-manager',
    });

    const res = await request(app)
      .get('/api/v1/manager/clients/cust-1')
      .set('Authorization', `Bearer ${makeManagerToken()}`);

    expect(res.status).toBe(403);
  });
});

// ─── Client deletion ────────────────────────────────────────────────────────
describe('DELETE /api/v1/manager/clients/:customerId', () => {
  it('returns all unmet conditions in a single 422 response', async () => {
    (prisma.customerAssignment.findUnique as any).mockResolvedValue({
      customerId: 'cust-1',
      accountManagerId: MANAGER_ID,
    });
    (prisma.debitCard.findMany as any).mockResolvedValue([{ status: 'active' }]);
    (prisma.creditCard.findMany as any).mockResolvedValue([
      { status: 'active', creditLimit: decimal(2000), outstandingBalance: decimal(0) },
    ]);
    (prisma.bankAccount.findMany as any).mockResolvedValue([{ balance: decimal(75) }]);

    const res = await request(app)
      .delete('/api/v1/manager/clients/cust-1')
      .set('Authorization', `Bearer ${makeManagerToken()}`);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CLIENT_DELETION_BLOCKED');
    expect(res.body.unmet).toEqual(
      expect.arrayContaining([
        'debit_cards_not_disabled',
        'credit_cards_not_disabled',
        'account_balance_not_zero',
      ]),
    );
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('deletes the client when all conditions are met', async () => {
    (prisma.customerAssignment.findUnique as any).mockResolvedValue({
      customerId: 'cust-1',
      accountManagerId: MANAGER_ID,
    });
    (prisma.debitCard.findMany as any).mockResolvedValue([{ status: 'closed' }]);
    (prisma.creditCard.findMany as any).mockResolvedValue([]);
    (prisma.bankAccount.findMany as any).mockResolvedValue([{ balance: decimal(0) }]);
    (prisma.user.delete as any).mockResolvedValue({});

    const res = await request(app)
      .delete('/api/v1/manager/clients/cust-1')
      .set('Authorization', `Bearer ${makeManagerToken()}`);

    expect(res.status).toBe(200);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'cust-1' } });
  });
});

// ─── Approve side-effects ───────────────────────────────────────────────────
describe('POST /api/v1/manager/requests/:id/approve', () => {
  it('creates a new bank account and marks the request approved for open_account', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-1',
      customerId: 'cust-1',
      accountManagerId: MANAGER_ID,
      type: 'open_account',
      status: 'pending',
      payload: { type: 'savings' },
    });
    (prisma.bankAccount.create as any).mockResolvedValue({ id: 'acct-new' });
    (prisma.request.update as any).mockResolvedValue({
      id: 'req-1',
      customerId: 'cust-1',
      accountManagerId: MANAGER_ID,
      type: 'open_account',
      status: 'approved',
      payload: { type: 'savings' },
      rejectionReason: null,
      createdAt: new Date(),
      actionedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/manager/requests/req-1/approve')
      .set('Authorization', `Bearer ${makeManagerToken()}`);

    expect(res.status).toBe(200);
    expect(prisma.bankAccount.create).toHaveBeenCalled();
    expect(prisma.request.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { status: 'approved', actionedAt: expect.any(Date) },
    });
  });

  it('deducts balance atomically for withdraw_money', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-2',
      customerId: 'cust-1',
      accountManagerId: MANAGER_ID,
      type: 'withdraw_money',
      status: 'pending',
      payload: { account_id: 'acct-1', amount: 100 },
    });
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'cust-1',
      status: 'active',
      balance: decimal(500),
    });
    (prisma.request.update as any).mockResolvedValue({
      id: 'req-2',
      customerId: 'cust-1',
      accountManagerId: MANAGER_ID,
      type: 'withdraw_money',
      status: 'approved',
      payload: { account_id: 'acct-1', amount: 100 },
      rejectionReason: null,
      createdAt: new Date(),
      actionedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/manager/requests/req-2/approve')
      .set('Authorization', `Bearer ${makeManagerToken()}`);

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('returns 422 and leaves the request pending when close_credit_card balance < credit_limit', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-3',
      customerId: 'cust-1',
      accountManagerId: MANAGER_ID,
      type: 'close_credit_card',
      status: 'pending',
      payload: { card_id: 'cc-1' },
    });
    (prisma.creditCard.findUnique as any).mockResolvedValue({
      id: 'cc-1',
      customerId: 'cust-1',
      status: 'active',
      creditLimit: decimal(2000),
      outstandingBalance: decimal(-300),
    });

    const res = await request(app)
      .post('/api/v1/manager/requests/req-3/approve')
      .set('Authorization', `Bearer ${makeManagerToken()}`);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('BALANCE_BELOW_LIMIT');
    expect(prisma.request.update).not.toHaveBeenCalled();
  });

  it('returns 403 when the request belongs to another manager portfolio', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-4',
      customerId: 'cust-1',
      accountManagerId: 'other-manager',
      type: 'freeze_account',
      status: 'pending',
      payload: { account_id: 'acct-1' },
    });

    const res = await request(app)
      .post('/api/v1/manager/requests/req-4/approve')
      .set('Authorization', `Bearer ${makeManagerToken()}`);

    expect(res.status).toBe(403);
  });

  it('returns 422 NOT_PENDING when approving an already-approved request', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-5',
      customerId: 'cust-1',
      accountManagerId: MANAGER_ID,
      type: 'freeze_account',
      status: 'approved',
      payload: { account_id: 'acct-1' },
    });

    const res = await request(app)
      .post('/api/v1/manager/requests/req-5/approve')
      .set('Authorization', `Bearer ${makeManagerToken()}`);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NOT_PENDING');
  });
});

// ─── Reject ──────────────────────────────────────────────────────────────────
describe('POST /api/v1/manager/requests/:id/reject', () => {
  it('returns 400 when reason is missing', async () => {
    const res = await request(app)
      .post('/api/v1/manager/requests/req-1/reject')
      .set('Authorization', `Bearer ${makeManagerToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('stores the rejection reason and marks the request rejected', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-1',
      customerId: 'cust-1',
      accountManagerId: MANAGER_ID,
      type: 'freeze_account',
      status: 'pending',
      payload: { account_id: 'acct-1' },
    });
    (prisma.request.update as any).mockResolvedValue({
      id: 'req-1',
      customerId: 'cust-1',
      accountManagerId: MANAGER_ID,
      type: 'freeze_account',
      status: 'rejected',
      payload: { account_id: 'acct-1' },
      rejectionReason: 'Not eligible',
      createdAt: new Date(),
      actionedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/manager/requests/req-1/reject')
      .set('Authorization', `Bearer ${makeManagerToken()}`)
      .send({ reason: 'Not eligible' });

    expect(res.status).toBe(200);
    expect(res.body.data.rejectionReason).toBe('Not eligible');
    expect(prisma.request.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { status: 'rejected', rejectionReason: 'Not eligible', actionedAt: expect.any(Date) },
    });
  });
});
