import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

process.env.JWT_SECRET = 'test-secret-for-unit-tests';

vi.mock('../lib/prisma', () => ({
  default: {
    bankAccount: {
      findUnique: vi.fn(),
    },
    debitCard: {
      findUnique: vi.fn(),
    },
    creditCard: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    request: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customerAssignment: {
      findUnique: vi.fn(),
    },
  },
}));

import app from '../app';
import prisma from '../lib/prisma';

const SECRET = process.env.JWT_SECRET!;

function makeToken(): string {
  return jwt.sign(
    { sub: 'user-1', role: 'customer', jti: randomUUID() },
    SECRET,
    { expiresIn: '8h' },
  );
}

function decimal(value: number) {
  return { toNumber: () => value, toString: () => value.toFixed(2) };
}

const CREATED_REQUEST = {
  id: 'req-new',
  customerId: 'user-1',
  accountManagerId: null,
  type: 'open_account',
  status: 'pending',
  payload: {},
  rejectionReason: null,
  createdAt: new Date(),
  actionedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.customerAssignment.findUnique as any).mockResolvedValue(null);
  (prisma.request.findMany as any).mockResolvedValue([]);
  (prisma.request.create as any).mockResolvedValue(CREATED_REQUEST);
  (prisma.request.update as any).mockResolvedValue({});
});

// ─── Account Requests ──────────────────────────────────────────────────────────

describe('POST /api/v1/requests — account requests', () => {
  it('returns 422 BALANCE_NOT_ZERO when requesting close_account with non-zero balance', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'user-1',
      status: 'active',
      balance: decimal(150),
    });

    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ type: 'close_account', payload: { account_id: 'acct-1' } });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('BALANCE_NOT_ZERO');
  });

  it('returns 422 DUPLICATE_PENDING when a matching pending request already exists', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'user-1',
      status: 'active',
      balance: decimal(0),
    });
    (prisma.request.findMany as any).mockResolvedValue([
      { payload: { account_id: 'acct-1' } },
    ]);

    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ type: 'close_account', payload: { account_id: 'acct-1' } });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('DUPLICATE_PENDING');
  });

  it('returns 422 NOT_FROZEN when requesting unfreeze_account on an active account', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'user-1',
      status: 'active',
      balance: decimal(0),
    });

    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ type: 'unfreeze_account', payload: { account_id: 'acct-1' } });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NOT_FROZEN');
  });
});

// ─── Card Requests ─────────────────────────────────────────────────────────────

describe('POST /api/v1/requests — card requests', () => {
  it('returns 422 CREDIT_CARD_EXISTS when customer already has a non-closed credit card', async () => {
    (prisma.creditCard.findFirst as any).mockResolvedValue({
      id: 'cc-1',
      customerId: 'user-1',
      status: 'active',
    });

    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ type: 'issue_credit_card', payload: {} });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CREDIT_CARD_EXISTS');
  });

  it('returns 422 ACCOUNT_NOT_ACTIVE when issuing debit card to a frozen account', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'user-1',
      status: 'frozen',
    });

    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ type: 'issue_debit_card', payload: { account_id: 'acct-1' } });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ACCOUNT_NOT_ACTIVE');
  });
});

// ─── Request Cancel ────────────────────────────────────────────────────────────

describe('DELETE /api/v1/requests/:id', () => {
  it('returns 200 when cancelling a pending request', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-1',
      customerId: 'user-1',
      status: 'pending',
    });

    const res = await request(app)
      .delete('/api/v1/requests/req-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Request cancelled successfully');
  });

  it('returns 422 NOT_PENDING when cancelling an approved request', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-1',
      customerId: 'user-1',
      status: 'approved',
    });

    const res = await request(app)
      .delete('/api/v1/requests/req-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NOT_PENDING');
  });

  it('returns 422 NOT_PENDING when cancelling a rejected request', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-1',
      customerId: 'user-1',
      status: 'rejected',
    });

    const res = await request(app)
      .delete('/api/v1/requests/req-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NOT_PENDING');
  });
});
