import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import prisma from '../lib/prisma';

const router = Router();

/**
 * @openapi
 * /api/v1/cards/debit:
 *   get:
 *     tags: [Cards]
 *     summary: Get the authenticated customer's debit cards (with linked account info)
 *     responses:
 *       200:
 *         description: List of debit cards
 *       401:
 *         description: Unauthorized
 */
router.get('/debit', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const cards = await prisma.debitCard.findMany({
      where: { customerId: req.user!.id },
      include: { bankAccount: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      data: cards.map((c) => ({
        id: c.id,
        bankAccountId: c.bankAccountId,
        customerId: c.customerId,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        bankAccount: {
          id: c.bankAccount.id,
          iban: c.bankAccount.iban,
          type: c.bankAccount.type,
          status: c.bankAccount.status,
          balance: c.bankAccount.balance.toString(),
        },
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/cards/credit:
 *   get:
 *     tags: [Cards]
 *     summary: Get the authenticated customer's credit cards
 *     responses:
 *       200:
 *         description: List of credit cards
 *       401:
 *         description: Unauthorized
 */
router.get('/credit', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const cards = await prisma.creditCard.findMany({
      where: { customerId: req.user!.id },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      data: cards.map((c) => ({
        id: c.id,
        customerId: c.customerId,
        status: c.status,
        creditLimit: c.creditLimit.toString(),
        outstandingBalance: c.outstandingBalance.toString(),
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
