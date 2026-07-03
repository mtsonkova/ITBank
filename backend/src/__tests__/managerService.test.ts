import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    customerAssignment: {
      findUnique: vi.fn(),
    },
    bankAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    debitCard: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    creditCard: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      delete: vi.fn(),
    },
    request: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((ops: unknown) => Promise.resolve(ops)),
  },
}));

import prisma from '../lib/prisma';
import {
  requireClientInPortfolio,
  setAccountStatus,
  setDebitCardStatus,
  setCreditCardStatus,
  issueDebitCard,
  checkDeletionConditions,
} from '../services/managerService';

function decimal(value: number) {
  return { toNumber: () => value, toString: () => value.toFixed(2) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Portfolio scoping ──────────────────────────────────────────────────────
describe('requireClientInPortfolio', () => {
  it('throws 403 when the customer has no assignment', async () => {
    (prisma.customerAssignment.findUnique as any).mockResolvedValue(null);
    await expect(requireClientInPortfolio('mgr-1', 'cust-1')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('throws 403 when the customer is assigned to a different manager', async () => {
    (prisma.customerAssignment.findUnique as any).mockResolvedValue({
      customerId: 'cust-1',
      accountManagerId: 'mgr-2',
    });
    await expect(requireClientInPortfolio('mgr-1', 'cust-1')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('resolves when the customer belongs to the manager', async () => {
    (prisma.customerAssignment.findUnique as any).mockResolvedValue({
      customerId: 'cust-1',
      accountManagerId: 'mgr-1',
    });
    await expect(requireClientInPortfolio('mgr-1', 'cust-1')).resolves.toBeDefined();
  });
});

// ─── Bank account status transitions ───────────────────────────────────────
describe('setAccountStatus', () => {
  it('blocks close_account with 422 BALANCE_NOT_ZERO when balance is non-zero', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'cust-1',
      status: 'active',
      balance: decimal(150),
    });

    await expect(setAccountStatus('cust-1', 'acct-1', 'closed')).rejects.toMatchObject({
      statusCode: 422,
      code: 'BALANCE_NOT_ZERO',
    });
    expect(prisma.bankAccount.update).not.toHaveBeenCalled();
  });

  it('allows close_account when balance is zero', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'cust-1',
      status: 'active',
      balance: decimal(0),
    });
    (prisma.bankAccount.update as any).mockResolvedValue({ id: 'acct-1', status: 'closed' });

    await setAccountStatus('cust-1', 'acct-1', 'closed');
    expect(prisma.bankAccount.update).toHaveBeenCalledWith({
      where: { id: 'acct-1' },
      data: { status: 'closed' },
    });
  });

  it('rejects unfreezing an account that was never frozen (closed)', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'cust-1',
      status: 'closed',
      balance: decimal(0),
    });

    await expect(setAccountStatus('cust-1', 'acct-1', 'active')).rejects.toMatchObject({
      statusCode: 422,
      code: 'NOT_FROZEN',
    });
  });

  it('rejects freezing an account that is closed', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'cust-1',
      status: 'closed',
      balance: decimal(0),
    });

    await expect(setAccountStatus('cust-1', 'acct-1', 'frozen')).rejects.toMatchObject({
      statusCode: 422,
      code: 'NOT_ACTIVE',
    });
  });

  it('rejects freezing an account that is already frozen (no-op transition)', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'cust-1',
      status: 'frozen',
      balance: decimal(0),
    });

    await expect(setAccountStatus('cust-1', 'acct-1', 'frozen')).rejects.toMatchObject({
      statusCode: 422,
      code: 'INVALID_TRANSITION',
    });
  });
});

// ─── Debit card issuance ────────────────────────────────────────────────────
describe('issueDebitCard', () => {
  it('blocks issuance to a frozen account with 422 ACCOUNT_NOT_ACTIVE', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'cust-1',
      status: 'frozen',
    });

    await expect(issueDebitCard('cust-1', 'acct-1')).rejects.toMatchObject({
      statusCode: 422,
      code: 'ACCOUNT_NOT_ACTIVE',
    });
  });

  it('issues a card when the account is active', async () => {
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'cust-1',
      status: 'active',
    });
    (prisma.debitCard.create as any).mockResolvedValue({ id: 'card-1' });

    await issueDebitCard('cust-1', 'acct-1');
    expect(prisma.debitCard.create).toHaveBeenCalledWith({
      data: { bankAccountId: 'acct-1', customerId: 'cust-1', status: 'active' },
    });
  });
});

describe('setDebitCardStatus', () => {
  it('rejects unfreezing a closed debit card', async () => {
    (prisma.debitCard.findUnique as any).mockResolvedValue({
      id: 'card-1',
      customerId: 'cust-1',
      status: 'closed',
    });

    await expect(setDebitCardStatus('cust-1', 'card-1', 'active')).rejects.toMatchObject({
      statusCode: 422,
      code: 'NOT_FROZEN',
    });
  });
});

// ─── Credit card closure ────────────────────────────────────────────────────
describe('setCreditCardStatus', () => {
  it('blocks close_credit_card with 422 BALANCE_BELOW_LIMIT when balance < credit_limit', async () => {
    (prisma.creditCard.findUnique as any).mockResolvedValue({
      id: 'cc-1',
      customerId: 'cust-1',
      status: 'active',
      creditLimit: decimal(2000),
      outstandingBalance: decimal(-500),
    });

    await expect(setCreditCardStatus('cust-1', 'cc-1', 'closed')).rejects.toMatchObject({
      statusCode: 422,
      code: 'BALANCE_BELOW_LIMIT',
    });
    expect(prisma.creditCard.update).not.toHaveBeenCalled();
  });

  it('allows close_credit_card when balance >= credit_limit', async () => {
    (prisma.creditCard.findUnique as any).mockResolvedValue({
      id: 'cc-1',
      customerId: 'cust-1',
      status: 'active',
      creditLimit: decimal(2000),
      outstandingBalance: decimal(2000),
    });
    (prisma.creditCard.update as any).mockResolvedValue({ id: 'cc-1', status: 'closed' });

    await setCreditCardStatus('cust-1', 'cc-1', 'closed');
    expect(prisma.creditCard.update).toHaveBeenCalledWith({
      where: { id: 'cc-1' },
      data: { status: 'closed' },
    });
  });
});

// ─── Client deletion conditions ─────────────────────────────────────────────
describe('checkDeletionConditions', () => {
  it('returns all unmet conditions independently in a single response', async () => {
    (prisma.debitCard.findMany as any).mockResolvedValue([{ status: 'active' }]);
    (prisma.creditCard.findMany as any).mockResolvedValue([
      { status: 'active', creditLimit: decimal(2000), outstandingBalance: decimal(-100) },
    ]);
    (prisma.bankAccount.findMany as any).mockResolvedValue([{ balance: decimal(50) }]);

    const unmet = await checkDeletionConditions('cust-1');
    expect(unmet).toEqual(
      expect.arrayContaining([
        'debit_cards_not_disabled',
        'credit_cards_not_disabled',
        'credit_card_balance_below_limit',
        'account_balance_not_zero',
      ]),
    );
    expect(unmet).toHaveLength(4);
  });

  it('returns an empty array when every condition is satisfied', async () => {
    (prisma.debitCard.findMany as any).mockResolvedValue([{ status: 'closed' }]);
    (prisma.creditCard.findMany as any).mockResolvedValue([
      { status: 'frozen', creditLimit: decimal(2000), outstandingBalance: decimal(2000) },
    ]);
    (prisma.bankAccount.findMany as any).mockResolvedValue([{ balance: decimal(0) }]);

    const unmet = await checkDeletionConditions('cust-1');
    expect(unmet).toEqual([]);
  });

  it('checks condition 3 against the credit limit, not merely zero', async () => {
    (prisma.debitCard.findMany as any).mockResolvedValue([]);
    (prisma.creditCard.findMany as any).mockResolvedValue([
      { status: 'closed', creditLimit: decimal(2000), outstandingBalance: decimal(0) },
    ]);
    (prisma.bankAccount.findMany as any).mockResolvedValue([]);

    const unmet = await checkDeletionConditions('cust-1');
    expect(unmet).toContain('credit_card_balance_below_limit');
  });
});
