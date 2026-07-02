import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

process.env.JWT_SECRET = 'test-secret-for-unit-tests';

vi.mock('../lib/prisma', () => ({
  default: {
    bankAccount: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    debitCard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    creditCard: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
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

function activeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-1',
    customerId: 'user-1',
    iban: 'IB12ABCD1234ABCD1234',
    type: 'savings',
    status: 'active',
    balance: decimal(500),
    ...overrides,
  };
}

function activeDebitCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'card-1',
    customerId: 'user-1',
    bankAccountId: 'acct-1',
    status: 'active',
    bankAccount: {
      id: 'acct-1',
      iban: 'IB12ABCD1234ABCD1234',
      type: 'savings',
      status: 'active',
      balance: decimal(500),
    },
    ...overrides,
  };
}

function activeCreditCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cc-1',
    customerId: 'user-1',
    status: 'active',
    outstandingBalance: decimal(1000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as any).mockImplementation(
    async (ops: Promise<unknown>[]) => Promise.all(ops),
  );
  (prisma.bankAccount.update as any).mockResolvedValue({});
  (prisma.creditCard.update as any).mockResolvedValue({});
  (prisma.transaction.create as any).mockResolvedValue({});
  (prisma.bankAccount.findMany as any).mockResolvedValue([]);
  (prisma.debitCard.findMany as any).mockResolvedValue([]);
});

// ─── Deposit ──────────────────────────────────────────────────────────────────

describe('POST /api/v1/transactions/deposit', () => {
  it('increments account balance and records a deposit transaction', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue(activeAccount());

    const res = await request(app)
      .post('/api/v1/transactions/deposit')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ account_id: 'acct-1', amount: 200 });

    expect(res.status).toBe(201);
    expect(prisma.bankAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { balance: { increment: 200 } } }),
    );
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'deposit', toAccountId: 'acct-1', amount: 200 }),
      }),
    );
  });
});

// ─── Transfer same-customer ────────────────────────────────────────────────────

describe('POST /api/v1/transactions/transfer', () => {
  it('returns 422 SOURCE_NOT_ACTIVE when source account is frozen', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue(
      activeAccount({ status: 'frozen' }),
    );

    const res = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ from_type: 'account', from_id: 'acct-1', to_type: 'account', to_id: 'acct-2', amount: 50 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SOURCE_NOT_ACTIVE');
  });

  it('returns 422 INSUFFICIENT_FUNDS with top_up_sources when bank account balance is too low', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue(
      activeAccount({ balance: decimal(10) }),
    );

    const res = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ from_type: 'account', from_id: 'acct-1', to_type: 'account', to_id: 'acct-2', amount: 100 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
    expect(Array.isArray(res.body.top_up_sources)).toBe(true);
  });

  it('allows credit card source to overdraft with no balance check', async () => {
    (prisma.creditCard.findUnique as any).mockResolvedValueOnce(activeCreditCard());
    (prisma.bankAccount.findUnique as any).mockResolvedValue(activeAccount({ id: 'acct-2' }));

    const res = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ from_type: 'credit_card', from_id: 'cc-1', to_type: 'account', to_id: 'acct-2', amount: 99999 });

    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('returns 422 DEST_NOT_ACTIVE when destination account is closed', async () => {
    (prisma.bankAccount.findUnique as any)
      .mockResolvedValueOnce(activeAccount({ id: 'acct-1' }))
      .mockResolvedValueOnce(activeAccount({ id: 'acct-2', status: 'closed' }));

    const res = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ from_type: 'account', from_id: 'acct-1', to_type: 'account', to_id: 'acct-2', amount: 50 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('DEST_NOT_ACTIVE');
  });
});

// ─── Transfer cross-customer ───────────────────────────────────────────────────

describe('POST /api/v1/transactions/transfer/external', () => {
  it('returns 422 INSUFFICIENT_FUNDS without top_up_sources when balance is too low', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue(
      activeAccount({ balance: decimal(10) }),
    );

    const res = await request(app)
      .post('/api/v1/transactions/transfer/external')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ from_account_id: 'acct-1', to_iban: 'IB99XXXX', amount: 100 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
    expect(res.body.top_up_sources).toBeUndefined();
  });

  it('returns 404 IBAN_NOT_FOUND when destination IBAN does not exist', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue(activeAccount());
    (prisma.bankAccount.findFirst as any).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/transactions/transfer/external')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ from_account_id: 'acct-1', to_iban: 'IB99UNKNOWNIBAN', amount: 50 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('IBAN_NOT_FOUND');
  });
});

// ─── Spend ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/transactions/spend', () => {
  it('returns 422 INSUFFICIENT_FUNDS with top_up_sources when account balance is too low', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue(
      activeAccount({ balance: decimal(10) }),
    );
    (prisma.bankAccount.findMany as any).mockResolvedValue([
      activeAccount({ id: 'acct-2' }),
    ]);

    const res = await request(app)
      .post('/api/v1/transactions/spend')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ source_type: 'account', source_id: 'acct-1', amount: 100 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
    expect(Array.isArray(res.body.top_up_sources)).toBe(true);
  });

  it('never blocks credit card spend — overdraft always permitted', async () => {
    (prisma.creditCard.findUnique as any).mockResolvedValue(activeCreditCard());

    const res = await request(app)
      .post('/api/v1/transactions/spend')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ source_type: 'credit_card', source_id: 'cc-1', amount: 99999 });

    expect(res.status).toBe(201);
  });

  it('debit card spend draws from linked bank account', async () => {
    (prisma.debitCard.findUnique as any).mockResolvedValue(activeDebitCard());

    const res = await request(app)
      .post('/api/v1/transactions/spend')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ source_type: 'debit_card', source_id: 'card-1', amount: 100 });

    expect(res.status).toBe(201);
    expect(prisma.bankAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'acct-1' } }),
    );
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ debitCardId: 'card-1', fromAccountId: 'acct-1' }),
      }),
    );
  });

  it('returns 422 INSUFFICIENT_FUNDS when debit card linked account has too little balance', async () => {
    (prisma.debitCard.findUnique as any).mockResolvedValue({
      id: 'card-1',
      customerId: 'user-1',
      bankAccountId: 'acct-1',
      status: 'active',
      bankAccount: {
        id: 'acct-1',
        iban: 'IB12ABCD1234ABCD1234',
        type: 'savings',
        status: 'active',
        balance: decimal(5),
      },
    });

    const res = await request(app)
      .post('/api/v1/transactions/spend')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ source_type: 'debit_card', source_id: 'card-1', amount: 100 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
  });
});

// ─── Insufficient funds response — top_up_sources composition ─────────────────

describe('INSUFFICIENT_FUNDS response — top_up_sources', () => {
  it('excludes the failing source account from top_up_sources', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue(
      activeAccount({ id: 'acct-1', balance: decimal(0) }),
    );
    (prisma.bankAccount.findMany as any).mockResolvedValue([
      activeAccount({ id: 'acct-2' }),
    ]);

    const res = await request(app)
      .post('/api/v1/transactions/spend')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ source_type: 'account', source_id: 'acct-1', amount: 100 });

    expect(res.status).toBe(422);
    const sources = res.body.top_up_sources as { id: string }[];
    expect(sources.some((s) => s.id === 'acct-1')).toBe(false);
    expect(sources.some((s) => s.id === 'acct-2')).toBe(true);
  });

  it('includes frozen accounts in top_up_sources with status "frozen"', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue(
      activeAccount({ id: 'acct-1', balance: decimal(0) }),
    );
    (prisma.bankAccount.findMany as any).mockResolvedValue([
      activeAccount({ id: 'acct-2', status: 'frozen' }),
    ]);

    const res = await request(app)
      .post('/api/v1/transactions/spend')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ source_type: 'account', source_id: 'acct-1', amount: 100 });

    expect(res.status).toBe(422);
    const sources = res.body.top_up_sources as { id: string; status: string }[];
    expect(sources.find((s) => s.id === 'acct-2')?.status).toBe('frozen');
  });

  it('marks debit card as frozen in top_up_sources when linked account is frozen', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue(
      activeAccount({ id: 'acct-1', balance: decimal(0) }),
    );
    (prisma.bankAccount.findMany as any).mockResolvedValue([]);
    (prisma.debitCard.findMany as any).mockResolvedValue([
      {
        id: 'card-2',
        customerId: 'user-1',
        bankAccountId: 'acct-2',
        status: 'active',
        bankAccount: {
          id: 'acct-2',
          iban: 'IB12YYYY1234YYYY1234',
          type: 'savings',
          status: 'frozen',
          balance: decimal(200),
        },
      },
    ]);

    const res = await request(app)
      .post('/api/v1/transactions/spend')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ source_type: 'account', source_id: 'acct-1', amount: 100 });

    expect(res.status).toBe(422);
    const sources = res.body.top_up_sources as { id: string; status: string }[];
    expect(sources.find((s) => s.id === 'card-2')?.status).toBe('frozen');
  });
});

// ─── Top-up amount validation ──────────────────────────────────────────────────

describe('POST /api/v1/transactions/topup', () => {
  it('returns 400 when amount is 0 (falsy guard treats it as missing)', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/topup')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ from_type: 'account', from_id: 'acct-1', to_card_id: 'cc-1', amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });

  it('returns 422 INVALID_AMOUNT when amount is negative', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/topup')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ from_type: 'account', from_id: 'acct-1', to_card_id: 'cc-1', amount: -50 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_AMOUNT');
  });
});
