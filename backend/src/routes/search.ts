import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../lib/AppError';
import { parsePage, parseLimit } from '../services/historyService';
import { resolveSearchScope, parseSearchQuery, querySearchPage, querySearchAll } from '../services/searchService';
import { isExportFormat, generateSearchExport } from '../services/exportService';

const router = Router();

/**
 * @openapi
 * /api/v1/search:
 *   get:
 *     tags: [Search]
 *     summary: Role-scoped global search across accounts, cards, transactions, users and managers
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
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
 *         description: Search results grouped by entity type (each independently paginated), or a combined file download when `export` is set
 *       400:
 *         description: q shorter than 2 characters, or an unknown export format
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, authorize('customer', 'account_manager', 'admin'), async (req, res, next) => {
  try {
    const q = parseSearchQuery(req.query.q);
    const scope = await resolveSearchScope({ id: req.user!.id, role: req.user!.role });

    if (req.query.export !== undefined) {
      if (!isExportFormat(req.query.export)) {
        throw new AppError(400, 'export must be one of csv, xlsx, xls, ods, pdf', 'INVALID_EXPORT_FORMAT');
      }
      const data = await querySearchAll(scope, q);
      const { buffer, contentType, extension } = await generateSearchExport(data, req.query.export);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="search-results.${extension}"`);
      res.send(buffer);
      return;
    }

    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const result = await querySearchPage(scope, q, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
