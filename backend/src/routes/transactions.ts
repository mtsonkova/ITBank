import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../lib/AppError';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';

const router = Router();

/**
 * @openapi
 * /api/v1/transactions/recent:
 *   get:
 *     tags: [Transactions]
 *     summary: Get the most recent transactions for the authenticated customer
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: List of recent transactions
 *       401:
 *         description: Unauthorized
 */
router.get('/recent', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const customerId = req.user!.id;
    const limit = Math.min(parseInt((req.query.limit as string) ?? '5', 10) || 5, 20);

    const [accounts, debitCards, creditCards] = await Promise.all([
      prisma.bankAccount.findMany({ where: { customerId }, select: { id: true } }),
      prisma.debitCard.findMany({ where: { customerId }, select: { id: true } }),
      prisma.creditCard.findMany({ where: { customerId }, select: { id: true } }),
    ]);

    const accountIds = accounts.map((a) => a.id);
    const debitCardIds = debitCards.map((c) => c.id);
    const creditCardIds = creditCards.map((c) => c.id);

    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { fromAccountId: { in: accountIds } },
          { toAccountId: { in: accountIds } },
          { fromCardId: { in: debitCardIds } },
          { toCardId: { in: creditCardIds } },
          { debitCardId: { in: debitCardIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      data: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        fromAccountId: t.fromAccountId,
        toAccountId: t.toAccountId,
        fromCardId: t.fromCardId,
        toCardId: t.toCardId,
        debitCardId: t.debitCardId,
        amount: t.amount.toString(),
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/transactions/spend ─────────────────────────────────────────
/**
 * @openapi
 * /api/v1/transactions/spend:
 *   post:
 *     tags: [Transactions]
 *     summary: Spend from an account, debit card, or credit card
 */
router.post('/spend', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const customerId = req.user!.id;
    const { source_type, source_id, amount, description } = req.body as {
      source_type?: string;
      source_id?: string;
      amount?: number;
      description?: string;
    };

    if (!source_type || !source_id || !amount) {
      throw new AppError(400, 'source_type, source_id and amount are required', 'MISSING_FIELDS');
    }
    if (!['account', 'debit_card', 'credit_card'].includes(source_type)) {
      throw new AppError(400, 'source_type must be account, debit_card or credit_card', 'INVALID_SOURCE_TYPE');
    }
    if (amount <= 0) {
      throw new AppError(422, 'Amount must be greater than €0.00', 'INVALID_AMOUNT');
    }

    if (source_type === 'account') {
      const account = await prisma.bankAccount.findUnique({ where: { id: source_id } });
      if (!account || account.customerId !== customerId) {
        throw new AppError(404, 'Account not found', 'NOT_FOUND');
      }
      if (account.status !== 'active') {
        throw new AppError(422, 'Account is not active', 'ACCOUNT_NOT_ACTIVE');
      }
      if (account.balance.toNumber() < amount) {
        const sources = await buildTopUpSources(customerId, 'account', source_id);
        throw new AppError(422, 'Insufficient funds', 'INSUFFICIENT_FUNDS', {
          available_balance: account.balance.toString(),
          required_amount: amount.toFixed(2),
          top_up_sources: sources,
        });
      }
      await prisma.$transaction([
        prisma.bankAccount.update({ where: { id: account.id }, data: { balance: { decrement: amount } } }),
        prisma.transaction.create({
          data: { type: 'spend', fromAccountId: account.id, amount, description: description ?? null },
        }),
      ]);
    } else if (source_type === 'debit_card') {
      const card = await prisma.debitCard.findUnique({ where: { id: source_id }, include: { bankAccount: true } });
      if (!card || card.customerId !== customerId) {
        throw new AppError(404, 'Debit card not found', 'NOT_FOUND');
      }
      if (card.status !== 'active') {
        throw new AppError(422, 'Debit card is not active', 'CARD_NOT_ACTIVE');
      }
      if (card.bankAccount.status !== 'active') {
        throw new AppError(422, 'Linked account is not active', 'ACCOUNT_NOT_ACTIVE');
      }
      if (card.bankAccount.balance.toNumber() < amount) {
        const sources = await buildTopUpSources(customerId, 'debit_card', source_id);
        throw new AppError(422, 'Insufficient funds', 'INSUFFICIENT_FUNDS', {
          available_balance: card.bankAccount.balance.toString(),
          required_amount: amount.toFixed(2),
          top_up_sources: sources,
        });
      }
      await prisma.$transaction([
        prisma.bankAccount.update({ where: { id: card.bankAccountId }, data: { balance: { decrement: amount } } }),
        prisma.transaction.create({
          data: {
            type: 'spend',
            fromAccountId: card.bankAccountId,
            debitCardId: card.id,
            amount,
            description: description ?? null,
          },
        }),
      ]);
    } else {
      // credit_card — overdraft always permitted
      const card = await prisma.creditCard.findUnique({ where: { id: source_id } });
      if (!card || card.customerId !== customerId) {
        throw new AppError(404, 'Credit card not found', 'NOT_FOUND');
      }
      if (card.status !== 'active') {
        throw new AppError(422, 'Credit card is not active', 'CARD_NOT_ACTIVE');
      }
      await prisma.$transaction([
        prisma.creditCard.update({ where: { id: card.id }, data: { outstandingBalance: { decrement: amount } } }),
        prisma.transaction.create({
          data: {
            type: 'spend',
            toCardId: card.id,
            amount,
            description: description ?? null,
          },
        }),
      ]);
    }

    res.status(201).json({ message: 'Spend recorded' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/transactions/topup ─────────────────────────────────────────
/**
 * @openapi
 * /api/v1/transactions/topup:
 *   post:
 *     tags: [Transactions]
 *     summary: Top up a credit card from an account or debit card
 */
router.post('/topup', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const customerId = req.user!.id;
    const { from_type, from_id, to_card_id, amount } = req.body as {
      from_type?: string;
      from_id?: string;
      to_card_id?: string;
      amount?: number;
    };

    if (!from_type || !from_id || !to_card_id || !amount) {
      throw new AppError(400, 'from_type, from_id, to_card_id and amount are required', 'MISSING_FIELDS');
    }
    if (!['account', 'debit_card'].includes(from_type)) {
      throw new AppError(400, 'from_type must be account or debit_card', 'INVALID_FROM_TYPE');
    }
    if (amount <= 0) {
      throw new AppError(422, 'Amount must be greater than €0.00', 'INVALID_AMOUNT');
    }

    // Validate destination credit card
    const creditCard = await prisma.creditCard.findUnique({ where: { id: to_card_id } });
    if (!creditCard || creditCard.customerId !== customerId) {
      throw new AppError(404, 'Credit card not found', 'NOT_FOUND');
    }
    if (creditCard.status !== 'active') {
      throw new AppError(422, 'Credit card is not active', 'CARD_NOT_ACTIVE');
    }

    let sourceAccountId: string;

    if (from_type === 'account') {
      const account = await prisma.bankAccount.findUnique({ where: { id: from_id } });
      if (!account || account.customerId !== customerId) {
        throw new AppError(404, 'Account not found', 'NOT_FOUND');
      }
      if (account.status !== 'active') {
        throw new AppError(422, 'Source account is not active', 'ACCOUNT_NOT_ACTIVE');
      }
      if (account.balance.toNumber() < amount) {
        throw new AppError(422, 'Insufficient funds', 'INSUFFICIENT_FUNDS');
      }
      sourceAccountId = account.id;

      await prisma.$transaction([
        prisma.bankAccount.update({
          where: { id: account.id },
          data: { balance: { decrement: amount } },
        }),
        prisma.creditCard.update({
          where: { id: creditCard.id },
          data: { outstandingBalance: { increment: amount } },
        }),
        prisma.transaction.create({
          data: {
            type: 'topup',
            fromAccountId: account.id,
            toCardId: creditCard.id,
            amount,
          },
        }),
      ]);
    } else {
      // from_type === 'debit_card'
      const debitCard = await prisma.debitCard.findUnique({
        where: { id: from_id },
        include: { bankAccount: true },
      });
      if (!debitCard || debitCard.customerId !== customerId) {
        throw new AppError(404, 'Debit card not found', 'NOT_FOUND');
      }
      if (debitCard.status !== 'active') {
        throw new AppError(422, 'Debit card is not active', 'CARD_NOT_ACTIVE');
      }
      if (debitCard.bankAccount.status !== 'active') {
        throw new AppError(422, 'Linked account is not active', 'ACCOUNT_NOT_ACTIVE');
      }
      if (debitCard.bankAccount.balance.toNumber() < amount) {
        throw new AppError(422, 'Insufficient funds', 'INSUFFICIENT_FUNDS');
      }
      sourceAccountId = debitCard.bankAccountId;

      await prisma.$transaction([
        prisma.bankAccount.update({
          where: { id: debitCard.bankAccountId },
          data: { balance: { decrement: amount } },
        }),
        prisma.creditCard.update({
          where: { id: creditCard.id },
          data: { outstandingBalance: { increment: amount } },
        }),
        prisma.transaction.create({
          data: {
            type: 'topup',
            fromAccountId: sourceAccountId,
            fromCardId: debitCard.id,
            toCardId: creditCard.id,
            amount,
          },
        }),
      ]);
    }

    res.status(201).json({ message: 'Top-up successful' });
  } catch (err) {
    next(err);
  }
});

// ─── Helper: build top-up sources (accounts + debit cards, excl. closed) ──────
async function buildTopUpSources(
  customerId: string,
  excludeType?: string,
  excludeId?: string,
): Promise<{ id: string; type: string; label: string; balance: string; status: string }[]> {
  const [accounts, debitCards] = await Promise.all([
    prisma.bankAccount.findMany({ where: { customerId, status: { not: 'closed' } } }),
    prisma.debitCard.findMany({
      where: { customerId, status: { not: 'closed' } },
      include: { bankAccount: true },
    }),
  ]);

  const sources: { id: string; type: string; label: string; balance: string; status: string }[] = [];

  for (const a of accounts) {
    if (excludeType === 'account' && excludeId === a.id) continue;
    sources.push({
      id: a.id,
      type: 'account',
      label: `${a.type.charAt(0).toUpperCase() + a.type.slice(1)} ${a.iban}`,
      balance: a.balance.toString(),
      status: a.status,
    });
  }

  for (const c of debitCards) {
    if (excludeType === 'debit_card' && excludeId === c.id) continue;
    const effectiveStatus =
      c.status === 'active' && c.bankAccount.status === 'active' ? 'active' : 'frozen';
    sources.push({
      id: c.id,
      type: 'debit_card',
      label: `Debit Card ${c.bankAccount.iban}`,
      balance: c.bankAccount.balance.toString(),
      status: effectiveStatus,
    });
  }

  return sources;
}

// ─── POST /api/v1/transactions/deposit ───────────────────────────────────────
/**
 * @openapi
 * /api/v1/transactions/deposit:
 *   post:
 *     tags: [Transactions]
 *     summary: Deposit money into a customer's bank account
 */
router.post('/deposit', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const customerId = req.user!.id;
    const { account_id, amount } = req.body as { account_id?: string; amount?: number };

    if (!account_id || !amount) {
      throw new AppError(400, 'account_id and amount are required', 'MISSING_FIELDS');
    }
    if (amount <= 0) {
      throw new AppError(422, 'Amount must be greater than €0.00', 'INVALID_AMOUNT');
    }

    const account = await prisma.bankAccount.findUnique({ where: { id: account_id } });
    if (!account || account.customerId !== customerId) {
      throw new AppError(404, 'Account not found', 'NOT_FOUND');
    }
    if (account.status !== 'active') {
      throw new AppError(422, 'Account is not active', 'ACCOUNT_NOT_ACTIVE');
    }

    await prisma.$transaction([
      prisma.bankAccount.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      }),
      prisma.transaction.create({
        data: { type: 'deposit', toAccountId: account.id, amount },
      }),
    ]);

    res.status(201).json({ message: 'Deposit successful' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/transactions/transfer ──────────────────────────────────────
/**
 * @openapi
 * /api/v1/transactions/transfer:
 *   post:
 *     tags: [Transactions]
 *     summary: Same-customer transfer between any two instruments
 */
router.post('/transfer', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const customerId = req.user!.id;
    const { from_type, from_id, to_type, to_id, amount, note } = req.body as {
      from_type?: string;
      from_id?: string;
      to_type?: string;
      to_id?: string;
      amount?: number;
      note?: string;
    };

    const VALID_TYPES = ['account', 'debit_card', 'credit_card'];
    if (!from_type || !from_id || !to_type || !to_id || !amount) {
      throw new AppError(400, 'from_type, from_id, to_type, to_id and amount are required', 'MISSING_FIELDS');
    }
    if (!VALID_TYPES.includes(from_type) || !VALID_TYPES.includes(to_type)) {
      throw new AppError(400, 'Invalid instrument type', 'INVALID_TYPE');
    }
    if (amount <= 0) {
      throw new AppError(422, 'Amount must be greater than €0.00', 'INVALID_AMOUNT');
    }
    if (from_type === to_type && from_id === to_id) {
      throw new AppError(422, 'Cannot transfer to the same instrument', 'SAME_INSTRUMENT');
    }

    // ── Resolve source instrument ─────────────────────────────────────────────
    let fromAccountId: string | null = null;
    let fromCardId: string | null = null;
    let fromCreditCardId: string | null = null;
    let availableBalance: number | null = null;

    if (from_type === 'account') {
      const acct = await prisma.bankAccount.findUnique({ where: { id: from_id } });
      if (!acct || acct.customerId !== customerId) throw new AppError(404, 'Source account not found', 'NOT_FOUND');
      if (acct.status !== 'active') throw new AppError(422, 'Source account is not active', 'SOURCE_NOT_ACTIVE');
      fromAccountId = acct.id;
      availableBalance = acct.balance.toNumber();
    } else if (from_type === 'debit_card') {
      const card = await prisma.debitCard.findUnique({ where: { id: from_id }, include: { bankAccount: true } });
      if (!card || card.customerId !== customerId) throw new AppError(404, 'Source debit card not found', 'NOT_FOUND');
      if (card.status !== 'active') throw new AppError(422, 'Source debit card is not active', 'SOURCE_NOT_ACTIVE');
      if (card.bankAccount.status !== 'active') throw new AppError(422, 'Linked account is not active', 'SOURCE_NOT_ACTIVE');
      fromAccountId = card.bankAccountId;
      fromCardId = card.id;
      availableBalance = card.bankAccount.balance.toNumber();
    } else {
      // credit_card source — overdraft permitted
      const card = await prisma.creditCard.findUnique({ where: { id: from_id } });
      if (!card || card.customerId !== customerId) throw new AppError(404, 'Source credit card not found', 'NOT_FOUND');
      if (card.status !== 'active') throw new AppError(422, 'Source credit card is not active', 'SOURCE_NOT_ACTIVE');
      fromCreditCardId = card.id;
    }

    // ── Insufficient funds check ─────────────────────────────────────────────
    if (availableBalance !== null && availableBalance < amount) {
      const sources = await buildTopUpSources(customerId, from_type, from_id);
      throw new AppError(422, 'Insufficient funds', 'INSUFFICIENT_FUNDS', {
        available_balance: availableBalance.toFixed(2),
        required_amount: amount.toFixed(2),
        top_up_sources: sources,
      });
    }

    // ── Resolve destination instrument ────────────────────────────────────────
    let toAccountId: string | null = null;
    let toCardId: string | null = null;

    if (to_type === 'account') {
      const acct = await prisma.bankAccount.findUnique({ where: { id: to_id } });
      if (!acct || acct.customerId !== customerId) throw new AppError(404, 'Destination account not found', 'NOT_FOUND');
      if (acct.status !== 'active') throw new AppError(422, 'Destination account is not active', 'DEST_NOT_ACTIVE');
      toAccountId = acct.id;
    } else if (to_type === 'debit_card') {
      const card = await prisma.debitCard.findUnique({ where: { id: to_id }, include: { bankAccount: true } });
      if (!card || card.customerId !== customerId) throw new AppError(404, 'Destination debit card not found', 'NOT_FOUND');
      if (card.status !== 'active') throw new AppError(422, 'Destination debit card is not active', 'DEST_NOT_ACTIVE');
      if (card.bankAccount.status !== 'active') throw new AppError(422, 'Linked account is not active', 'DEST_NOT_ACTIVE');
      toAccountId = card.bankAccountId;
    } else {
      const card = await prisma.creditCard.findUnique({ where: { id: to_id } });
      if (!card || card.customerId !== customerId) throw new AppError(404, 'Destination credit card not found', 'NOT_FOUND');
      if (card.status !== 'active') throw new AppError(422, 'Destination credit card is not active', 'DEST_NOT_ACTIVE');
      toCardId = card.id;
    }

    // ── Atomic transaction ────────────────────────────────────────────────────
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (fromAccountId) {
      ops.push(prisma.bankAccount.update({ where: { id: fromAccountId }, data: { balance: { decrement: amount } } }));
    } else if (fromCreditCardId) {
      ops.push(prisma.creditCard.update({ where: { id: fromCreditCardId }, data: { outstandingBalance: { decrement: amount } } }));
    }

    if (toAccountId) {
      ops.push(prisma.bankAccount.update({ where: { id: toAccountId }, data: { balance: { increment: amount } } }));
    } else if (toCardId) {
      ops.push(prisma.creditCard.update({ where: { id: toCardId }, data: { outstandingBalance: { increment: amount } } }));
    }

    ops.push(
      prisma.transaction.create({
        data: {
          type: 'transfer',
          fromAccountId,
          toAccountId,
          fromCardId,
          toCardId,
          amount,
          description: note ?? null,
        },
      }),
    );

    await prisma.$transaction(ops);
    res.status(201).json({ message: 'Transfer successful' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/transactions/transfer/external ─────────────────────────────
/**
 * @openapi
 * /api/v1/transactions/transfer/external:
 *   post:
 *     tags: [Transactions]
 *     summary: Cross-customer account-to-account transfer by IBAN
 */
router.post('/transfer/external', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const customerId = req.user!.id;
    const { from_account_id, to_iban, amount } = req.body as {
      from_account_id?: string;
      to_iban?: string;
      amount?: number;
    };

    if (!from_account_id || !to_iban || !amount) {
      throw new AppError(400, 'from_account_id, to_iban and amount are required', 'MISSING_FIELDS');
    }
    if (amount <= 0) {
      throw new AppError(422, 'Amount must be greater than €0.00', 'INVALID_AMOUNT');
    }

    const fromAccount = await prisma.bankAccount.findUnique({ where: { id: from_account_id } });
    if (!fromAccount || fromAccount.customerId !== customerId) {
      throw new AppError(404, 'Source account not found', 'NOT_FOUND');
    }
    if (fromAccount.status !== 'active') {
      throw new AppError(422, 'Source account is not active', 'ACCOUNT_NOT_ACTIVE');
    }
    if (fromAccount.balance.toNumber() < amount) {
      throw new AppError(422, 'Insufficient funds', 'INSUFFICIENT_FUNDS', {
        available_balance: fromAccount.balance.toString(),
        required_amount: amount.toFixed(2),
      });
    }

    const normalised = to_iban.replace(/\s/g, '').toUpperCase();
    const toAccount = await prisma.bankAccount.findFirst({ where: { iban: normalised } });
    if (!toAccount) {
      throw new AppError(404, 'Destination account not found', 'IBAN_NOT_FOUND');
    }
    if (toAccount.id === fromAccount.id) {
      throw new AppError(422, 'Cannot transfer to the same account', 'SAME_ACCOUNT');
    }
    if (toAccount.status !== 'active') {
      throw new AppError(422, 'Destination account is not active', 'DEST_NOT_ACTIVE');
    }

    await prisma.$transaction([
      prisma.bankAccount.update({ where: { id: fromAccount.id }, data: { balance: { decrement: amount } } }),
      prisma.bankAccount.update({ where: { id: toAccount.id }, data: { balance: { increment: amount } } }),
      prisma.transaction.create({
        data: {
          type: 'transfer_external',
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          amount,
        },
      }),
    ]);

    res.status(201).json({ message: 'Transfer successful' });
  } catch (err) {
    next(err);
  }
});

export default router;
