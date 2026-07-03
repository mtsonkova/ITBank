import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AppShell } from '../../components/layout/AppShell';
import { RequestActions } from '../../components/manager/RequestActions';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/axios';
import { formatDate } from '../../lib/formatters';
import { REQ_TYPE_LABELS } from '../../lib/requestLabels';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ManagerClient {
  id: string;
  fullName: string;
  accountsCount: number;
  cardsCount: number;
  totalBalance: string;
  pendingRequestsCount: number;
  frozenAccountsCount: number;
  frozenCardsCount: number;
  status: string;
}

interface ManagerRequest {
  id: string;
  customerId: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  rejectionReason: string | null;
  createdAt: string;
  customer?: { id: string; fullName: string; username: string };
}

const CLOSURE_TYPES = new Set(['close_account', 'close_credit_card']);

// ─── Fetchers ─────────────────────────────────────────────────────────────────
const fetchClients = () =>
  api.get<{ data: ManagerClient[] }>('/api/v1/manager/clients').then((r) => r.data.data);

const fetchPendingRequests = () =>
  api
    .get<{ data: ManagerRequest[] }>('/api/v1/manager/requests?status=pending')
    .then((r) => r.data.data);

function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error ?? 'Something went wrong';
  return 'Something went wrong';
}

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

// ─── Main component ───────────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ['managerClients'], queryFn: fetchClients });
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['managerRequests', 'pending'],
    queryFn: fetchPendingRequests,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/manager/requests/${id}/approve`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['managerRequests'] });
      qc.invalidateQueries({ queryKey: ['managerClients'] });
    },
    onError: (err) => alert(apiError(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/api/v1/manager/requests/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['managerRequests'] }),
    onError: (err) => alert(apiError(err)),
  });

  const frozenItems = clients.reduce(
    (sum, c) => sum + c.frozenAccountsCount + c.frozenCardsCount,
    0,
  );
  const awaitingClosure = pendingRequests.filter((r) => CLOSURE_TYPES.has(r.type)).length;
  const latestRequests = pendingRequests.slice(0, 4);

  return (
    <AppShell pageTitle="Dashboard">
      <div data-testid="screen-manager-dashboard" className="space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#0F172A]">
            Account Manager workspace
          </h1>
          <p className="text-sm text-[#5B6B7A] mt-0.5">
            {user?.fullName} · {clients.length} assigned {clients.length === 1 ? 'client' : 'clients'}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Assigned Clients" value={clients.length} testId="stat-assigned-clients" />
          <StatCard
            label="Pending Approvals"
            value={pendingRequests.length}
            amber={pendingRequests.length > 0}
            testId="stat-pending-approvals"
          />
          <StatCard label="Frozen Items" value={frozenItems} testId="stat-frozen-items" />
          <StatCard label="Awaiting Closure" value={awaitingClosure} testId="stat-awaiting-closure" />
        </div>

        {/* Requests awaiting action */}
        <div className="bg-white rounded-xl shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-[#0F172A]">Requests awaiting your action</h2>
            <Link
              to="/manager/approvals"
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
      </div>
    </AppShell>
  );
}
