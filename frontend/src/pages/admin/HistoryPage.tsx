import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../../components/layout/AppShell';
import { HistoryTable } from '../../components/history/HistoryTable';
import { Pagination } from '../../components/history/Pagination';
import { ExportMenu } from '../../components/history/ExportMenu';
import { TX_TYPE_LABELS } from '../../lib/transactionLabels';
import api from '../../lib/axios';
import type { TransactionHistoryItem } from '@banking-simulator/shared-types';

interface AdminCustomer {
  id: string;
  fullName: string;
}
interface AdminManager {
  id: string;
  fullName: string;
}

interface HistoryResponse {
  data: TransactionHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const fetchCustomers = () =>
  api.get<{ data: AdminCustomer[] }>('/api/v1/admin/customers').then((r) => r.data.data);
const fetchManagers = () =>
  api.get<{ data: AdminManager[] }>('/api/v1/admin/managers').then((r) => r.data.data);

interface Filters {
  from: string;
  to: string;
  type: string;
  customerId: string;
  managerId: string;
  page: number;
  limit: number;
}

const INITIAL_FILTERS: Filters = {
  from: '',
  to: '',
  type: '',
  customerId: '',
  managerId: '',
  page: 1,
  limit: 10,
};

export default function AdminHistoryPage() {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const { data: customers = [] } = useQuery({ queryKey: ['adminCustomers'], queryFn: fetchCustomers });
  const { data: managers = [] } = useQuery({ queryKey: ['adminManagers'], queryFn: fetchManagers });

  const queryParams = {
    from: filters.from || undefined,
    to: filters.to || undefined,
    type: filters.type || undefined,
    customer_id: filters.customerId || undefined,
    manager_id: filters.customerId ? undefined : filters.managerId || undefined,
    page: String(filters.page),
    limit: String(filters.limit),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['adminHistory', queryParams],
    queryFn: () =>
      api
        .get<HistoryResponse>('/api/v1/admin/transactions/history', { params: queryParams })
        .then((r) => r.data),
  });

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: key === 'page' ? (value as number) : 1 }));
  }

  return (
    <AppShell pageTitle="Transaction History">
      <div data-testid="screen-admin-history" className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold text-[#0F172A]">Transaction History</h1>
          <ExportMenu endpoint="/api/v1/admin/transactions/history" params={queryParams} testIdPrefix="admin-history" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-ui font-medium text-[#4A5A67]">Date from</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => updateFilter('from', e.target.value)}
              data-testid="admin-history-filter-from"
              className="border border-border-input rounded px-3 py-2 text-sm font-ui focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-ui font-medium text-[#4A5A67]">Date to</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => updateFilter('to', e.target.value)}
              data-testid="admin-history-filter-to"
              className="border border-border-input rounded px-3 py-2 text-sm font-ui focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-ui font-medium text-[#4A5A67]">Customer</label>
            <select
              value={filters.customerId}
              onChange={(e) => updateFilter('customerId', e.target.value)}
              data-testid="admin-history-filter-customer"
              className="border border-border-input rounded px-3 py-2 text-sm font-ui focus:outline-none focus:border-brand-primary"
            >
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-ui font-medium text-[#4A5A67]">Manager</label>
            <select
              value={filters.managerId}
              onChange={(e) => updateFilter('managerId', e.target.value)}
              disabled={!!filters.customerId}
              data-testid="admin-history-filter-manager"
              className="border border-border-input rounded px-3 py-2 text-sm font-ui focus:outline-none focus:border-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All managers</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-ui font-medium text-[#4A5A67]">Type</label>
            <select
              value={filters.type}
              onChange={(e) => updateFilter('type', e.target.value)}
              data-testid="admin-history-filter-type"
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
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <HistoryTable items={data?.data ?? []} isLoading={isLoading} testIdPrefix="admin-history" />
          {data && data.total > 0 && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              limit={filters.limit}
              onPageChange={(page) => updateFilter('page', page)}
              onLimitChange={(limit) => setFilters((f) => ({ ...f, limit, page: 1 }))}
              testIdPrefix="admin-history"
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
