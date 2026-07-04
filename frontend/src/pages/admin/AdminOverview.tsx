import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AppShell } from '../../components/layout/AppShell';
import { RequestActions } from '../../components/manager/RequestActions';
import api from '../../lib/axios';
import { formatDate } from '../../lib/formatters';
import { REQ_TYPE_LABELS } from '../../lib/requestLabels';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminManager {
  id: string;
  username: string;
  fullName: string;
  clientCount: number;
  createdAt: string;
}

interface AdminCustomer {
  id: string;
  username: string;
  fullName: string;
  createdAt: string;
  managerId: string | null;
  managerName: string | null;
}

interface AdminRequest {
  id: string;
  customerId: string;
  accountManagerId: string | null;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  rejectionReason: string | null;
  createdAt: string;
  customer?: { id: string; fullName: string; username: string };
  accountManager?: { id: string; fullName: string; username: string } | null;
}

function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error ?? 'Something went wrong';
  return 'Something went wrong';
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────
const fetchManagers = () =>
  api.get<{ data: AdminManager[] }>('/api/v1/admin/managers').then((r) => r.data.data);

const fetchCustomers = () =>
  api.get<{ data: AdminCustomer[] }>('/api/v1/admin/customers').then((r) => r.data.data);

const fetchPendingRequests = () =>
  api
    .get<{ data: AdminRequest[] }>('/api/v1/admin/requests?status=pending')
    .then((r) => r.data.data);

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  amber,
  testId,
}: {
  label: string;
  value: string | number;
  amber?: boolean;
  testId?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5 flex flex-col gap-1">
      <p className="text-xs font-ui text-[#5B6B7A] uppercase tracking-wide">{label}</p>
      <p
        data-testid={testId}
        className={`font-display text-2xl font-semibold tabular-nums ${amber ? 'text-status-warningText' : 'text-[#0F172A]'}`}
      >
        {value}
      </p>
    </div>
  );
}

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase();
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminOverview() {
  const qc = useQueryClient();

  const { data: managers = [] } = useQuery({ queryKey: ['adminManagers'], queryFn: fetchManagers });
  const { data: customers = [] } = useQuery({ queryKey: ['adminCustomers'], queryFn: fetchCustomers });
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['adminRequests', 'pending'],
    queryFn: fetchPendingRequests,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/admin/requests/${id}/approve`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminRequests'] });
      qc.invalidateQueries({ queryKey: ['adminManagers'] });
      qc.invalidateQueries({ queryKey: ['adminCustomers'] });
    },
    onError: (err) => alert(apiError(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/api/v1/admin/requests/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminRequests'] }),
    onError: (err) => alert(apiError(err)),
  });

  const totalUsers = managers.length + customers.length;
  const latestRequests = pendingRequests.slice(0, 4);
  const latestManagers = managers.slice(0, 4);

  return (
    <AppShell pageTitle="Overview">
      <div data-testid="screen-admin-dashboard" className="space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#0F172A]">Admin overview</h1>
          <p className="text-sm text-[#5B6B7A] mt-0.5">
            System-wide snapshot across all account managers and customers.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={totalUsers} testId="stat-total-users" />
          <StatCard label="Account Managers" value={managers.length} testId="stat-account-managers" />
          <StatCard label="Customers" value={customers.length} testId="stat-customers" />
          <StatCard
            label="Pending Requests"
            value={pendingRequests.length}
            amber={pendingRequests.length > 0}
            testId="stat-pending-requests"
          />
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending requests */}
          <div className="bg-white rounded-xl shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-[#0F172A]">Pending requests</h2>
              <Link
                to="/admin/approvals"
                className="text-xs font-ui font-semibold text-brand-primary hover:text-brand-deep transition-colors"
              >
                View all
              </Link>
            </div>

            {latestRequests.length === 0 ? (
              <p className="text-sm text-[#8595A3]">No pending requests.</p>
            ) : (
              <ul className="divide-y divide-border">
                {latestRequests.map((r) => (
                  <li
                    key={r.id}
                    data-testid={`request-row-${r.id}`}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-ui font-medium text-[#0F172A]">
                        {REQ_TYPE_LABELS[r.type] ?? r.type}
                      </p>
                      <p className="text-xs font-ui text-[#8595A3] mt-0.5">
                        {r.customer?.fullName ?? r.customerId} · {formatDate(r.createdAt)}
                      </p>
                      <p className="text-xs font-ui text-[#8595A3]">
                        Manager: {r.accountManager?.fullName ?? '—'}
                      </p>
                    </div>
                    <RequestActions
                      requestId={r.id}
                      onApprove={() => approveMutation.mutate(r.id)}
                      onReject={(reason) => rejectMutation.mutate({ id: r.id, reason })}
                      approving={approveMutation.isPending}
                      rejecting={rejectMutation.isPending}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Account managers */}
          <div className="bg-white rounded-xl shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-[#0F172A]">Account managers</h2>
              <Link
                to="/admin/users"
                className="text-xs font-ui font-semibold text-brand-primary hover:text-brand-deep transition-colors"
              >
                View all
              </Link>
            </div>

            {latestManagers.length === 0 ? (
              <p className="text-sm text-[#8595A3]">No account managers yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {latestManagers.map((m) => (
                  <li
                    key={m.id}
                    data-testid={`manager-row-${m.id}`}
                    className="py-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-avatar-bg text-avatar-text text-xs font-semibold flex items-center justify-center shrink-0">
                      {getInitials(m.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-ui font-medium text-[#0F172A]">{m.fullName}</p>
                      <p className="text-xs font-ui text-[#8595A3] mt-0.5">
                        {m.clientCount} assigned {m.clientCount === 1 ? 'client' : 'clients'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
