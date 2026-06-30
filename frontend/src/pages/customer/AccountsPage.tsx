import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AppShell } from '../../components/layout/AppShell';
import api from '../../lib/axios';
import { formatCurrency, formatIBAN, formatDate } from '../../lib/formatters';
import type { BankAccount, Request } from '@banking-simulator/shared-types';

// ─── Types ────────────────────────────────────────────────────────────────────
type AccountReqType = 'open_account' | 'close_account' | 'freeze_account' | 'unfreeze_account';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCOUNT_REQ_TYPES: AccountReqType[] = [
  'open_account',
  'close_account',
  'freeze_account',
  'unfreeze_account',
];

const REQ_TYPE_LABELS: Record<string, string> = {
  open_account: 'Open Account',
  close_account: 'Close Account',
  freeze_account: 'Freeze Account',
  unfreeze_account: 'Unfreeze Account',
};

const ACCOUNT_STATUS_CLASSES: Record<string, string> = {
  active: 'bg-status-successBg text-status-successText',
  frozen: 'bg-status-warningBg text-status-warningText',
  closed: 'bg-status-dangerBg text-status-dangerText',
};

const REQ_STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-status-warningBg text-status-warningText',
  approved: 'bg-status-successBg text-status-successText',
  rejected: 'bg-status-dangerBg text-status-dangerText',
  cancelled: 'bg-border-light text-[#5B6B7A]',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error ?? 'Something went wrong';
  return 'Something went wrong';
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────
const fetchAccounts = () =>
  api.get<{ data: BankAccount[] }>('/api/v1/accounts').then((r) => r.data.data);

const fetchRequests = () =>
  api.get<{ data: Request[] }>('/api/v1/requests').then((r) => r.data.data);

// ─── Component ────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'savings' | 'current'>('savings');
  const [modalMsg, setModalMsg] = useState<{ text: string; error: boolean } | null>(null);

  const [actionMsg, setActionMsg] = useState<{ id: string; text: string; error: boolean } | null>(
    null,
  );

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  const { data: allRequests = [] } = useQuery({
    queryKey: ['requests'],
    queryFn: fetchRequests,
  });

  const accountRequests = allRequests.filter((r) =>
    ACCOUNT_REQ_TYPES.includes(r.type as AccountReqType),
  );

  // ── Mutations ──
  const createReq = useMutation({
    mutationFn: (body: { type: string; payload?: Record<string, unknown> }) =>
      api.post('/api/v1/requests', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  });

  const cancelReq = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/requests/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  });

  // ── Helpers ──
  function hasPending(accountId: string, type: AccountReqType) {
    return accountRequests.some(
      (r) =>
        r.type === type &&
        r.status === 'pending' &&
        (r.payload as { account_id?: string }).account_id === accountId,
    );
  }

  // ── Handlers ──
  async function handleAction(accountId: string, type: AccountReqType) {
    setActionMsg(null);
    try {
      await createReq.mutateAsync({ type, payload: { account_id: accountId } });
      setActionMsg({ id: accountId, text: 'Request submitted successfully.', error: false });
    } catch (err) {
      setActionMsg({ id: accountId, text: apiError(err), error: true });
    }
  }

  async function handleNewAccount() {
    setModalMsg(null);
    try {
      await createReq.mutateAsync({ type: 'open_account', payload: { type: modalType } });
      setModalMsg({ text: 'Request submitted! Your manager will review it shortly.', error: false });
      setTimeout(() => {
        setShowModal(false);
        setModalMsg(null);
        setModalType('savings');
      }, 1800);
    } catch (err) {
      setModalMsg({ text: apiError(err), error: true });
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelReq.mutateAsync(id);
    } catch {
      // no-op — table will not refresh, which signals the failure visually
    }
  }

  function closeModal() {
    setShowModal(false);
    setModalMsg(null);
    setModalType('savings');
  }

  // ── Render ──
  return (
    <AppShell pageTitle="Accounts">
      <div data-testid="screen-accounts" className="space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold text-[#0F172A]">Your Accounts</h1>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-ui font-semibold hover:bg-brand-deep transition-colors"
          >
            + Request New Account
          </button>
        </div>

        {/* Account cards */}
        {isLoading ? (
          <p className="text-sm text-[#8595A3]">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-[#8595A3]">No accounts yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onAction={handleAction}
                hasPending={hasPending}
                submitting={createReq.isPending}
                feedback={actionMsg?.id === account.id ? actionMsg : null}
              />
            ))}
          </div>
        )}

        {/* Account requests table */}
        <div className="bg-white rounded-xl shadow-card p-5">
          <h2 className="font-display font-semibold text-[#0F172A] mb-4">Account Requests</h2>
          {accountRequests.length === 0 ? (
            <p className="text-sm text-[#8595A3]">No account requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-ui">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 pr-6 text-xs font-semibold uppercase tracking-wide text-[#5B6B7A]">
                      Request
                    </th>
                    <th className="pb-3 pr-6 text-xs font-semibold uppercase tracking-wide text-[#5B6B7A]">
                      Submitted
                    </th>
                    <th className="pb-3 pr-6 text-xs font-semibold uppercase tracking-wide text-[#5B6B7A]">
                      Status
                    </th>
                    <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-[#5B6B7A]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accountRequests.map((req) => (
                    <tr
                      key={req.id}
                      data-testid={`request-row-${req.id}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-3 pr-6 text-[#0F172A]">
                        {REQ_TYPE_LABELS[req.type] ?? req.type}
                      </td>
                      <td className="py-3 pr-6 text-[#5B6B7A]">{formatDate(req.createdAt)}</td>
                      <td className="py-3 pr-6">
                        <span
                          data-testid={`request-status-${req.id}`}
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${REQ_STATUS_CLASSES[req.status] ?? ''}`}
                        >
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-3">
                        {req.status === 'pending' && (
                          <button
                            data-testid={`request-cancel-${req.id}`}
                            onClick={() => handleCancel(req.id)}
                            disabled={cancelReq.isPending}
                            className="px-3 py-1 rounded text-xs font-semibold border border-status-dangerText text-status-dangerText hover:bg-status-dangerBg transition-colors disabled:opacity-40"
                          >
                            Cancel
                          </button>
                        )}
                        {req.status === 'rejected' && req.rejectionReason && (
                          <span
                            data-testid={`request-reason-${req.id}`}
                            className="text-xs text-status-dangerText"
                          >
                            {req.rejectionReason}
                          </span>
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

      {/* New Account Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-sm mx-4 p-6 space-y-5">
            <h3 className="font-display font-semibold text-[#0F172A] text-lg">
              Request New Account
            </h3>

            <div className="space-y-3">
              <p className="text-sm font-ui text-[#5B6B7A]">Select account type</p>
              <div className="flex gap-4">
                {(['savings', 'current'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="newAccountType"
                      value={type}
                      checked={modalType === type}
                      onChange={() => setModalType(type)}
                      className="accent-brand-primary"
                    />
                    <span className="text-sm font-ui text-[#0F172A] capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {modalMsg && (
              <p
                data-testid={modalMsg.error ? 'msg-error' : 'msg-success'}
                className={`text-sm font-ui ${modalMsg.error ? 'text-status-errorText' : 'text-status-successText'}`}
              >
                {modalMsg.text}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg text-sm font-ui font-semibold text-[#5B6B7A] hover:bg-tint-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNewAccount}
                disabled={createReq.isPending}
                className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-ui font-semibold hover:bg-brand-deep transition-colors disabled:opacity-60"
              >
                {createReq.isPending ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── Account Card sub-component ───────────────────────────────────────────────
function AccountCard({
  account,
  onAction,
  hasPending,
  submitting,
  feedback,
}: {
  account: BankAccount;
  onAction: (id: string, type: AccountReqType) => void;
  hasPending: (id: string, type: AccountReqType) => boolean;
  submitting: boolean;
  feedback: { text: string; error: boolean } | null;
}) {
  return (
    <div
      data-testid={`account-row-${account.id}`}
      className="bg-white rounded-xl shadow-card p-5 flex flex-col gap-3"
    >
      {/* Type + status row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-ui font-semibold uppercase tracking-wide text-[#5B6B7A]">
          {account.type === 'savings' ? 'Savings' : 'Current'} Account
        </span>
        <span
          data-testid={`account-status-${account.id}`}
          className={`text-[10px] font-ui font-semibold px-2 py-0.5 rounded-full ${ACCOUNT_STATUS_CLASSES[account.status]}`}
        >
          {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
        </span>
      </div>

      {/* IBAN */}
      <p className="text-xs font-mono text-[#8595A3] tracking-wider">{formatIBAN(account.iban)}</p>

      {/* Balance */}
      <p
        data-testid={`account-balance-${account.id}`}
        className="font-display text-2xl font-semibold tabular-nums text-[#0F172A]"
      >
        {formatCurrency(account.balance)}
      </p>

      {/* Buttons */}
      {account.status !== 'closed' && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
          {account.status === 'active' && (
            <button
              data-testid={`account-freeze-${account.id}`}
              onClick={() => onAction(account.id, 'freeze_account')}
              disabled={hasPending(account.id, 'freeze_account') || submitting}
              className="px-3 py-1.5 rounded-lg border border-status-warningText text-status-warningText text-xs font-ui font-semibold hover:bg-status-warningBg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Freeze
            </button>
          )}
          {account.status === 'frozen' && (
            <button
              onClick={() => onAction(account.id, 'unfreeze_account')}
              disabled={hasPending(account.id, 'unfreeze_account') || submitting}
              className="px-3 py-1.5 rounded-lg border border-status-successText text-status-successText text-xs font-ui font-semibold hover:bg-status-successBg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Unfreeze
            </button>
          )}
          <button
            data-testid={`account-close-${account.id}`}
            onClick={() => onAction(account.id, 'close_account')}
            disabled={hasPending(account.id, 'close_account') || submitting}
            className="px-3 py-1.5 rounded-lg border border-status-dangerText text-status-dangerText text-xs font-ui font-semibold hover:bg-status-dangerBg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Request Close
          </button>
        </div>
      )}

      {/* Inline feedback */}
      {feedback && (
        <p
          data-testid={feedback.error ? 'msg-error' : 'msg-success'}
          className={`text-xs font-ui ${feedback.error ? 'text-status-errorText' : 'text-status-successText'}`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
