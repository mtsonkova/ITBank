import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import prisma from '../lib/prisma';
import { resolveInstrumentIds, type HistoryScope } from '../services/historyService';
import { handleHistoryRequest, type RawHistoryQuery } from './historyHandler';

const router = Router();

/**
 * @openapi
 * /api/v1/admin/transactions/history:
 *   get:
 *     tags: [Transactions]
 *     summary: System-wide paginated transaction history (optionally scoped to one customer or manager's portfolio)
 *     parameters:
 *       - in: query
 *         name: customer_id
 *         schema: { type: string }
 *       - in: query
 *         name: manager_id
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: account_id
 *         schema: { type: string }
 *       - in: query
 *         name: card_id
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: export
 *         schema: { type: string, enum: [csv, xlsx, xls, ods, pdf] }
 *     responses:
 *       200:
 *         description: Paginated transaction history, or a file download when `export` is set
 *       401:
 *         description: Unauthorized
 */
router.get('/history', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { customer_id, manager_id } = req.query as { customer_id?: string; manager_id?: string };

    let scope: HistoryScope | null = null;
    if (customer_id) {
      scope = await resolveInstrumentIds([customer_id]);
    } else if (manager_id) {
      const assignments = await prisma.customerAssignment.findMany({
        where: { accountManagerId: manager_id },
        select: { customerId: true },
      });
      scope = await resolveInstrumentIds(assignments.map((a) => a.customerId));
    }

    await handleHistoryRequest(res, scope, req.query as RawHistoryQuery);
  } catch (err) {
    next(err);
  }
});

export default router;
