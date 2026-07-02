import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../lib/AppError';
import prisma from '../lib/prisma';

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

export default router;
