import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import prisma from '../lib/prisma';

const router = Router();

/**
 * @openapi
 * /api/v1/accounts:
 *   get:
 *     tags: [Accounts]
 *     summary: Get the authenticated customer's bank accounts
 *     responses:
 *       200:
 *         description: List of bank accounts
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { customerId: req.user!.id },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      data: accounts.map((a) => ({
        id: a.id,
        customerId: a.customerId,
        iban: a.iban,
        type: a.type,
        status: a.status,
        balance: a.balance.toString(),
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
