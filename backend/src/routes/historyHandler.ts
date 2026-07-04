import type { Response } from 'express';
import { AppError } from '../lib/AppError';
import { type HistoryScope, parsePage, parseLimit, queryHistoryPage, queryHistoryAll } from '../services/historyService';
import { isExportFormat, generateExport } from '../services/exportService';

export interface RawHistoryQuery {
  from?: string;
  to?: string;
  type?: string;
  account_id?: string;
  card_id?: string;
  page?: string;
  limit?: string;
  export?: string;
}

// Shared by the customer/manager/admin history routes: same query params, same
// JSON-page-vs-file-export branching, only the resolved scope differs per role.
export async function handleHistoryRequest(
  res: Response,
  scope: HistoryScope | null,
  query: RawHistoryQuery,
): Promise<void> {
  const filters = {
    scope,
    from: query.from,
    to: query.to,
    type: query.type,
    accountId: query.account_id,
    cardId: query.card_id,
  };

  if (query.export !== undefined) {
    if (!isExportFormat(query.export)) {
      throw new AppError(400, 'export must be one of csv, xlsx, xls, ods, pdf', 'INVALID_EXPORT_FORMAT');
    }
    const items = await queryHistoryAll(filters);
    const { buffer, contentType, extension } = await generateExport(items, query.export);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="transaction-history.${extension}"`);
    res.send(buffer);
    return;
  }

  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const result = await queryHistoryPage({ ...filters, page, limit });
  res.json(result);
}
