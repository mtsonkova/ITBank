import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import prisma from '../lib/prisma';

const router = Router();

/**
 * @openapi
 * /api/v1/requests:
 *   get:
 *     tags: [Requests]
 *     summary: Get the authenticated customer's requests
 *     responses:
 *       200:
 *         description: List of requests
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const requests = await prisma.request.findMany({
      where: { customerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: requests.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        accountManagerId: r.accountManagerId,
        type: r.type,
        status: r.status,
        payload: r.payload,
        rejectionReason: r.rejectionReason,
        createdAt: r.createdAt.toISOString(),
        actionedAt: r.actionedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
