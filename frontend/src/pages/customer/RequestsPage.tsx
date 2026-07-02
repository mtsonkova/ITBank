import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../../components/layout/AppShell';
import api from '../../lib/axios';
import { formatDate } from '../../lib/formatters';
import type { Request } from '@banking-simulator/shared-types';

// ─── Constants ────────────────────────────────────────────────────────────────
const REQ_TYPE_LABELS: Record<string, string> = {
  open_account: 'Open Account',
  close_account: 'Close Account',
  freeze_account: 'Freeze Account',
  unfreeze_account: 'Unfreeze Account',
  issue_debit_card: 'Issue Debit Card',
  close_debit_card: 'Close Debit Card',
  freeze_debit_card: 'Freeze Debit Card',
  unfreeze_debit_card: 'Unfreeze Debit Card',
  issue_credit_card: 'Issue Credit Card',
  close_credit_card: 'Close Credit Card',
  freeze_credit_card: 'Freeze Credit Card',
  unfreeze_credit_card: 'Unfreeze Credit Card',
  increase_credit_limit: 'Increase Credit Limit',
  decrease_credit_limit: 'Decrease Credit Limit',
  withdraw_money: 'Withdraw Money',
};

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function apiError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response: { data: { error?: string } } }).response;
    return r.data?.error ?? 'An error occurred';
  }
  return 'An error occurred';
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RequestsPage() {
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['requests'],
    queryFn: () =>
      api.get<{ data: Request[] }>('/api/v1/requests').then((r) => r.data.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/v1/requests/${id}`).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['requests'] }),
    onError: (err) => alert(apiError(err)),
  });

  return (
    <AppShell pageTitle="My Requests">
      <div data-testid="screen-requests" className="p-6">
        <h1 className="font-display text-2xl font-bold text-[#0F172A] mb-1">My Requests</h1>
        <p className="text-sm font-ui text-gray-500 mb-6">
          Track the status of all your submitted requests.
        </p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <p className="text-sm font-ui text-gray-500 p-6">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="text-sm font-ui text-gray-500 p-6">No requests yet.</p>
          ) : (
            <table className="w-full text-sm font-ui">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Request</th>
                  <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Submitted</th>
                  <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((req) => (
                  <tr
                    key={req.id}
                    data-testid={`request-row-${req.id}`}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Type */}
                    <td className="px-5 py-4">
                      <span className="font-semibold text-[#0F172A]">
                        {REQ_TYPE_LABELS[req.type] ?? req.type}
                      </span>
                    </td>

                    {/* Submitted */}
                    <td className="px-5 py-4 text-gray-500">
                      {formatDate(req.createdAt)}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span
                        data-testid={`request-status-${req.id}`}
                        className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_CLASSES[req.status] ?? 'bg-gray-100 text-gray-500'}`}
                      >
                        {req.status}
                      </span>
                      {req.status === 'rejected' && req.rejectionReason && (
                        <p
                          data-testid={`request-reason-${req.id}`}
                          className="mt-1 text-xs text-red-600 max-w-xs"
                        >
                          {req.rejectionReason}
                        </p>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-4">
                      {req.status === 'pending' && (
                        <button
                          data-testid={`request-cancel-${req.id}`}
                          onClick={() => cancelMutation.mutate(req.id)}
                          disabled={cancelMutation.isPending}
                          className="text-xs font-semibold text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
