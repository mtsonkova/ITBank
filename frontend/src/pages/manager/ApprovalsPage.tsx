import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AppShell } from '../../components/layout/AppShell';
import { RequestActions } from '../../components/manager/RequestActions';
import api from '../../lib/axios';
import { formatDate } from '../../lib/formatters';
import { REQ_TYPE_LABELS, REQ_STATUS_CLASSES, payloadSummary } from '../../lib/requestLabels';

// ─── Types ────────────────────────────────────────────────────────────────────
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

type Tab = 'pending' | 'completed';

function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error ?? 'Something went wrong';
  return 'Something went wrong';
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────
const fetchRequests = () =>
  api.get<{ data: ManagerRequest[] }>('/api/v1/manager/requests').then((r) => r.data.data);

// ─── Main component ───────────────────────────────────────────────────────────
export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['managerRequests', 'all'],
    queryFn: fetchRequests,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/manager/requests/${id}/approve`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['managerRequests'] });
      qc.invalidateQueries({ queryKey: ['managerClients'] });
      qc.invalidateQueries({ queryKey: ['managerClient'] });
    },
    onError: (err) => alert(apiError(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/api/v1/manager/requests/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['managerRequests'] }),
    onError: (err) => alert(apiError(err)),
  });

  const pending = requests.filter((r) => r.status === 'pending');
  const completed = requests.filter((r) => r.status === 'approved' || r.status === 'rejected');
  const rows = tab === 'pending' ? pending : completed;

  return (
    <AppShell pageTitle="Approvals">
      <div data-testid="screen-approvals" className="space-y-6">
        <h1 className="font-display text-xl font-semibold text-[#0F172A]">Approvals</h1>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(['pending', 'completed'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              data-testid={`tab-${t}`}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-ui font-semibold capitalize border-b-2 transition-colors ${
                tab === t
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-[#5B6B7A] hover:text-[#0F172A]'
              }`}
            >
              {t} {t === 'pending' && pending.length > 0 ? `(${pending.length})` : ''}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <p className="text-sm font-ui text-gray-500 p-6">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm font-ui text-gray-500 p-6">
              {tab === 'pending' ? 'No pending requests.' : 'No completed requests yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-ui">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Customer</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Request</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Submitted</th>
                    {tab === 'completed' && (
                      <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                    )}
                    <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                      {tab === 'pending' ? 'Action' : 'Rejection Reason'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r) => (
                    <tr key={r.id} data-testid={`request-row-${r.id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-[#0F172A]">
                        {r.customer?.fullName ?? r.customerId}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-[#0F172A]">{REQ_TYPE_LABELS[r.type] ?? r.type}</p>
                        {payloadSummary(r.type, r.payload) && (
                          <p className="text-xs text-[#8595A3] mt-0.5">{payloadSummary(r.type, r.payload)}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[#5B6B7A]">{formatDate(r.createdAt)}</td>
                      {tab === 'completed' && (
                        <td className="px-5 py-4">
                          <span
                            data-testid={`request-status-${r.id}`}
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${REQ_STATUS_CLASSES[r.status] ?? ''}`}
                          >
                            {r.status}
                          </span>
                        </td>
                      )}
                      <td className="px-5 py-4">
                        {tab === 'pending' ? (
                          <RequestActions
                            requestId={r.id}
                            onApprove={() => approveMutation.mutate(r.id)}
                            onReject={(reason) => rejectMutation.mutate({ id: r.id, reason })}
                            approving={approveMutation.isPending}
                            rejecting={rejectMutation.isPending}
                          />
                        ) : r.status === 'rejected' && r.rejectionReason ? (
                          <span data-testid={`request-reason-${r.id}`} className="text-xs text-status-dangerText">
                            {r.rejectionReason}
                          </span>
                        ) : (
                          <span className="text-xs text-[#8595A3]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
