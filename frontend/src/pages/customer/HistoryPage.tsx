import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../../components/layout/AppShell';
import { HistoryTable } from '../../components/history/HistoryTable';
import { Pagination } from '../../components/history/Pagination';
import { ExportMenu } from '../../components/history/ExportMenu';
import { TX_TYPE_LABELS } from '../../lib/transactionLabels';
import { formatIBAN } from '../../lib/formatters';
import api from '../../lib/axios';
import type { BankAccount, DebitCard, CreditCard, TransactionHistoryItem } from '@banking-simulator/shared-types';

interface DebitCardWithAccount extends DebitCard {
  bankAccount: { id: string; iban: string; type: string; status: string; balance: string };
}

interface HistoryResponse {
  data: TransactionHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const fetchAccounts = () => api.get<{ data: BankAccount[] }>('/api/v1/accounts').then((r) => r.data.data);
const fetchDebitCards = () =>
  api.get<{ data: DebitCardWithAccount[] }>('/api/v1/cards/debit').then((r) => r.data.data);
const fetchCreditCards = () => api.get<{ data: CreditCard[] }>('/api/v1/cards/credit').then((r) => r.data.data);

interface Filters {
  from: string;
  to: string;
  type: string;
  instrument: string; // '' | `account:<id>` | `card:<id>`
  page: number;
  limit: number;
}

const INITIAL_FILTERS: Filters = { from: '', to: '', type: '', instrument: '', page: 1, limit: 10 };

export default function HistoryPage() {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts });
  const { data: debitCards = [] } = useQuery({ queryKey: ['debitCards'], queryFn: fetchDebitCards });
  const { data: creditCards = [] } = useQuery({ queryKey: ['creditCards'], queryFn: fetchCreditCards });

  const [instrumentKind, instrumentId] = filters.instrument.split(':');
  const queryParams = {
    from: filters.from || undefined,
    to: filters.to || undefined,
    type: filters.type || undefined,
    account_id: instrumentKind === 'account' ? instrumentId : undefined,
    card_id: instrumentKind === 'card' ? instrumentId : undefined,
    page: String(filters.page),
    limit: String(filters.limit),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['customerHistory', queryParams],
    queryFn: () =>
      api.get<HistoryResponse>('/api/v1/transactions/history', { params: queryParams }).then((r) => r.data),
  });

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: key === 'page' ? (value as number) : 1 }));
  }

  return (
    <AppShell pageTitle="Transaction History">
      <div data-testid="screen-history" className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold text-[#0F172A]">Transaction History</h1>
          <ExportMenu endpoint="/api/v1/transactions/history" params={queryParams} testIdPrefix="history" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-ui font-medium text-[#4A5A67]">Date from</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => updateFilter('from', e.target.value)}
              data-testid="history-filter-from"
              className="border border-border-input rounded px-3 py-2 text-sm font-ui focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-ui font-medium text-[#4A5A67]">Date to</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => updateFilter('to', e.target.value)}
              data-testid="history-filter-to"
              className="border border-border-input rounded px-3 py-2 text-sm font-ui focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-ui font-medium text-[#4A5A67]">Type</label>
            <select
              value={filters.type}
              onChange={(e) => updateFilter('type', e.target.value)}
              data-testid="history-filter-type"
              className="border border-border-input rounded px-3 py-2 text-sm font-ui focus:outline-none focus:border-brand-primary"
            >
              <option value="">All types</option>
              {Object.entries(TX_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-ui font-medium text-[#4A5A67]">Account / Card</label>
            <select
              value={filters.instrument}
              onChange={(e) => updateFilter('instrument', e.target.value)}
              data-testid="history-filter-instrument"
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
                  Debit Card {formatIBAN(c.bankAccount.iban)}
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

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <HistoryTable items={data?.data ?? []} isLoading={isLoading} testIdPrefix="history" />
          {data && data.total > 0 && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              limit={filters.limit}
              onPageChange={(page) => updateFilter('page', page)}
              onLimitChange={(limit) => setFilters((f) => ({ ...f, limit, page: 1 }))}
              testIdPrefix="history"
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
