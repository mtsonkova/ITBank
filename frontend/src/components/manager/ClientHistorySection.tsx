import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HistoryTable } from '../history/HistoryTable';
import { Pagination } from '../history/Pagination';
import { ExportMenu } from '../history/ExportMenu';
import { formatIBAN } from '../../lib/formatters';
import api from '../../lib/axios';
import type { TransactionHistoryItem } from '@banking-simulator/shared-types';

interface HistoryResponse {
  data: TransactionHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Filters {
  from: string;
  to: string;
  instrument: string; // '' | `account:<id>` | `card:<id>`
  page: number;
  limit: number;
}

const INITIAL_FILTERS: Filters = { from: '', to: '', instrument: '', page: 1, limit: 10 };

export function ClientHistorySection({
  customerId,
  accounts,
  debitCards,
  creditCards,
}: {
  customerId: string;
  accounts: { id: string; iban: string; type: string }[];
  debitCards: { id: string }[];
  creditCards: { id: string }[];
}) {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [instrumentKind, instrumentId] = filters.instrument.split(':');

  const queryParams = {
    customer_id: customerId,
    from: filters.from || undefined,
    to: filters.to || undefined,
    account_id: instrumentKind === 'account' ? instrumentId : undefined,
    card_id: instrumentKind === 'card' ? instrumentId : undefined,
    page: String(filters.page),
    limit: String(filters.limit),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['clientHistory', queryParams],
    queryFn: () =>
      api
        .get<HistoryResponse>('/api/v1/manager/transactions/history', { params: queryParams })
        .then((r) => r.data),
  });

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: key === 'page' ? (value as number) : 1 }));
  }

  return (
    <section data-testid="section-client-history" className="bg-white rounded-xl shadow-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-[#0F172A] text-lg">Transaction History</h2>
        <ExportMenu endpoint="/api/v1/manager/transactions/history" params={queryParams} testIdPrefix="client-history" />
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-ui font-medium text-[#4A5A67]">Date from</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter('from', e.target.value)}
            data-testid="client-history-filter-from"
            className="border border-border-input rounded px-3 py-2 text-sm font-ui focus:outline-none focus:border-brand-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-ui font-medium text-[#4A5A67]">Date to</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter('to', e.target.value)}
            data-testid="client-history-filter-to"
            className="border border-border-input rounded px-3 py-2 text-sm font-ui focus:outline-none focus:border-brand-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-ui font-medium text-[#4A5A67]">Account / Card</label>
          <select
            value={filters.instrument}
            onChange={(e) => updateFilter('instrument', e.target.value)}
            data-testid="client-history-filter-instrument"
            className="border border-border-input rounded px-3 py-2 text-sm font-ui focus:outline-none focus:border-brand-primary"
          >
            <option value="">All accounts &amp; cards</option>
            {accounts.map((a) => (
              <option key={a.id} value={`account:${a.id}`}>
                {a.type.charAt(0).toUpperCase() + a.type.slice(1)} {formatIBAN(a.iban)}
              </option>
            ))}
            {debitCards.map((c) => (
              <option key={c.id} value={`card:${c.id}`}>
                Debit Card
              </option>
            ))}
            {creditCards.map((c) => (
              <option key={c.id} value={`card:${c.id}`}>
                Credit Card
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border border-border-light rounded-lg overflow-hidden">
        <HistoryTable items={data?.data ?? []} isLoading={isLoading} testIdPrefix="client-history" />
        {data && data.total > 0 && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            limit={filters.limit}
            onPageChange={(page) => updateFilter('page', page)}
            onLimitChange={(limit) => setFilters((f) => ({ ...f, limit, page: 1 }))}
            testIdPrefix="client-history"
          />
        )}
      </div>
    </section>
  );
}
