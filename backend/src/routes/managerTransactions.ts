import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../lib/AppError';
import prisma from '../lib/prisma';
import { resolveInstrumentIds } from '../services/historyService';
import { handleHistoryRequest, type RawHistoryQuery } from './historyHandler';

const router = Router();

/**
 * @openapi
 * /api/v1/manager/transactions/history:
 *   get:
 *     tags: [Transactions]
 *     summary: Paginated transaction history across the manager's portfolio (optionally scoped to one customer)
 *     parameters:
 *       - in: query
 *         name: customer_id
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
 *       404:
 *         description: customer_id is not in the manager's portfolio
 */
router.get('/history', authenticate, authorize('account_manager'), async (req, res, next) => {
  try {
    const managerId = req.user!.id;
    const { customer_id } = req.query as { customer_id?: string };

    const assignments = await prisma.customerAssignment.findMany({
      where: { accountManagerId: managerId },
      select: { customerId: true },
    });
    const portfolioIds = assignments.map((a) => a.customerId);

    let customerIds = portfolioIds;
    if (customer_id) {
      if (!portfolioIds.includes(customer_id)) {
        throw new AppError(404, 'Client not found in your portfolio', 'NOT_FOUND');
      }
      customerIds = [customer_id];
    }

    const scope = await resolveInstrumentIds(customerIds);
    await handleHistoryRequest(res, scope, req.query as RawHistoryQuery);
  } catch (err) {
    next(err);
  }
});

export default router;
