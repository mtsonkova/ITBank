import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
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

export default router;
