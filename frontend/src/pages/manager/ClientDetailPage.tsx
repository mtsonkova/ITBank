import { useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AppShell } from '../../components/layout/AppShell';
import api from '../../lib/axios';
import { formatCurrency, formatIBAN, formatDate } from '../../lib/formatters';
import { REQ_TYPE_LABELS } from '../../lib/requestLabels';
import { ClientHistorySection } from '../../components/manager/ClientHistorySection';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Account {
  id: string;
  iban: string;
  type: string;
  status: string;
  balance: string;
}
interface DebitCardT {
  id: string;
  bankAccountId: string;
  status: string;
}
interface CreditCardT {
  id: string;
  status: string;
  creditLimit: string;
  outstandingBalance: string;
}
interface PendingRequest {
  id: string;
  type: string;
  status: string;
  createdAt: string;
}
interface ClientDetail {
  user: { id: string; username: string; fullName: string; createdAt: string };
  accounts: Account[];
  debitCards: DebitCardT[];
  creditCards: CreditCardT[];
  pendingRequests: PendingRequest[];
}

const ACCOUNT_STATUS_CLASSES: Record<string, string> = {
  active: 'bg-status-successBg text-status-successText',
  frozen: 'bg-status-warningBg text-status-warningText',
  closed: 'bg-status-dangerBg text-status-dangerText',
};

const UNMET_LABELS: Record<string, string> = {
  debit_cards_not_disabled: 'All debit cards must be frozen or closed.',
  credit_cards_not_disabled: 'All credit cards must be frozen or closed.',
  credit_card_balance_below_limit:
    'Credit card balance must be fully restored (equal to or above the credit limit).',
  account_balance_not_zero: 'All bank account balances must be €0.00.',
};

function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error ?? 'Something went wrong';
  return 'Something went wrong';
}

function computeUnmetConditions(detail: ClientDetail): string[] {
  const unmet: string[] = [];
  if (detail.debitCards.some((c) => c.status === 'active')) unmet.push('debit_cards_not_disabled');
  if (detail.creditCards.some((c) => c.status === 'active')) unmet.push('credit_cards_not_disabled');
  if (
    detail.creditCards.some((c) => parseFloat(c.outstandingBalance) < parseFloat(c.creditLimit))
  ) {
    unmet.push('credit_card_balance_below_limit');
  }
  if (detail.accounts.some((a) => parseFloat(a.balance) !== 0)) unmet.push('account_balance_not_zero');
  return unmet;
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────
const fetchClient = (id: string) =>
  api.get<{ data: ClientDetail }>(`/api/v1/manager/clients/${id}`).then((r) => r.data.data);

// ─── Main component ───────────────────────────────────────────────────────────
export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [modal, setModal] = useState<
    | { kind: 'open_account' }
    | { kind: 'issue_debit' }
    | { kind: 'issue_credit' }
    | { kind: 'delete_blocked'; unmet: string[] }
    | { kind: 'confirm_delete' }
    | null
  >(null);
  const [actionError, setActionError] = useState('');

  const { data: client, isLoading } = useQuery({
    queryKey: ['managerClient', id],
    queryFn: () => fetchClient(id!),
    enabled: !!id,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['managerClient', id] });
    qc.invalidateQueries({ queryKey: ['managerClients'] });
  }

  const openAccountMutation = useMutation({
    mutationFn: (type: 'savings' | 'current') =>
      api.post(`/api/v1/manager/clients/${id}/accounts`, { type }).then((r) => r.data),
    onSuccess: () => {
      invalidate();
      setModal(null);
    },
    onError: (err) => setActionError(apiError(err)),
  });

  const accountStatusMutation = useMutation({
    mutationFn: ({ accountId, status }: { accountId: string; status: string }) =>
      api
        .patch(`/api/v1/manager/clients/${id}/accounts/${accountId}`, { status })
        .then((r) => r.data),
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err)),
  });

  const issueDebitMutation = useMutation({
    mutationFn: (accountId: string) =>
      api.post(`/api/v1/manager/clients/${id}/debit-cards`, { account_id: accountId }).then((r) => r.data),
    onSuccess: () => {
      invalidate();
      setModal(null);
    },
    onError: (err) => setActionError(apiError(err)),
  });

  const debitStatusMutation = useMutation({
    mutationFn: ({ cardId, status }: { cardId: string; status: string }) =>
      api
        .patch(`/api/v1/manager/clients/${id}/debit-cards/${cardId}`, { status })
        .then((r) => r.data),
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err)),
  });

  const issueCreditMutation = useMutation({
    mutationFn: (creditLimit: number) =>
      api
        .post(`/api/v1/manager/clients/${id}/credit-cards`, { credit_limit: creditLimit })
        .then((r) => r.data),
    onSuccess: () => {
      invalidate();
      setModal(null);
    },
    onError: (err) => setActionError(apiError(err)),
  });

  const creditStatusMutation = useMutation({
    mutationFn: ({ cardId, status }: { cardId: string; status: string }) =>
      api
        .patch(`/api/v1/manager/clients/${id}/credit-cards/${cardId}`, { status })
        .then((r) => r.data),
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/manager/clients/${id}`).then((r) => r.data),
    onSuccess: () => navigate('/manager/clients', { replace: true }),
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.code === 'CLIENT_DELETION_BLOCKED') {
        setModal({ kind: 'delete_blocked', unmet: err.response.data.unmet });
      } else {
        alert(apiError(err));
      }
    },
  });

  function handleDeleteClick() {
    if (!client) return;
    const unmet = computeUnmetConditions(client);
    if (unmet.length > 0) {
      setModal({ kind: 'delete_blocked', unmet });
    } else {
      setModal({ kind: 'confirm_delete' });
    }
  }

  if (isLoading || !client) {
    return (
      <AppShell pageTitle="Client Detail">
        <p className="text-sm text-[#8595A3] p-6">Loading…</p>
      </AppShell>
    );
  }

  const activeAccounts = client.accounts.filter((a) => a.status === 'active');
  const hasNonClosedCreditCard = client.creditCards.some((c) => c.status !== 'closed');

  return (
    <AppShell pageTitle="Client Detail">
      <div data-testid="screen-client-detail" className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link to="/manager/clients" className="text-xs font-ui text-brand-primary hover:text-brand-deep">
              ← My Clients
            </Link>
            <h1 className="font-display text-xl font-semibold text-[#0F172A] mt-1">
              {client.user.fullName}
            </h1>
            <p className="text-xs font-ui text-[#8595A3]">@{client.user.username}</p>
          </div>
          <button
            type="button"
            data-testid="btn-delete-client"
            onClick={handleDeleteClick}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 rounded-lg border border-status-dangerText text-status-dangerText text-sm font-ui font-semibold hover:bg-status-dangerBg transition-colors disabled:opacity-50"
          >
            Delete Client
          </button>
        </div>

        {actionError && (
          <p data-testid="msg-error" className="text-sm text-status-errorText bg-status-errorBg rounded px-3 py-2">
            {actionError}
          </p>
        )}

        {/* Accounts */}
        <Section
          title="Accounts"
          testId="section-accounts"
          action={
            <button
              type="button"
              onClick={() => {
                setActionError('');
                setModal({ kind: 'open_account' });
              }}
              className="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-ui font-semibold hover:bg-brand-deep transition-colors"
            >
              + Open Account
            </button>
          }
        >
          {client.accounts.length === 0 ? (
            <p className="text-sm text-[#8595A3]">No accounts yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {client.accounts.map((account) => (
                <div
                  key={account.id}
                  data-testid={`account-row-${account.id}`}
                  className="border border-border rounded-lg p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-ui font-semibold uppercase tracking-wide text-[#5B6B7A] capitalize">
                      {account.type} Account
                    </span>
                    <span
                      data-testid={`account-status-${account.id}`}
                      className={`text-[10px] font-ui font-semibold px-2 py-0.5 rounded-full ${ACCOUNT_STATUS_CLASSES[account.status]}`}
                    >
                      {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#8595A3] tracking-wider">
                    {formatIBAN(account.iban)}
                  </p>
                  <p className="font-display text-lg font-semibold tabular-nums text-[#0F172A]">
                    {formatCurrency(account.balance)}
                  </p>
                  {account.status !== 'closed' && (
                    <div className="flex gap-3 pt-1 border-t border-border">
                      {account.status === 'active' && (
                        <button
                          data-testid={`account-freeze-${account.id}`}
                          onClick={() => accountStatusMutation.mutate({ accountId: account.id, status: 'frozen' })}
                          className="text-xs font-ui font-semibold text-status-warningText hover:opacity-80 transition-opacity"
                        >
                          Freeze
                        </button>
                      )}
                      {account.status === 'frozen' && (
                        <button
                          onClick={() => accountStatusMutation.mutate({ accountId: account.id, status: 'active' })}
                          className="text-xs font-ui font-semibold text-status-successText hover:opacity-80 transition-opacity"
                        >
                          Unfreeze
                        </button>
                      )}
                      <button
                        data-testid={`account-close-${account.id}`}
                        onClick={() => accountStatusMutation.mutate({ accountId: account.id, status: 'closed' })}
                        className="text-xs font-ui font-semibold text-status-dangerText hover:opacity-80 transition-opacity"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Debit Cards */}
        <Section
          title="Debit Cards"
          testId="section-debit-cards"
          action={
            <button
              type="button"
              onClick={() => {
                setActionError('');
                setModal({ kind: 'issue_debit' });
              }}
              disabled={activeAccounts.length === 0}
              className="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-ui font-semibold hover:bg-brand-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Issue Card
            </button>
          }
        >
          {client.debitCards.length === 0 ? (
            <p className="text-sm text-[#8595A3]">No debit cards yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {client.debitCards.map((card) => (
                <div
                  key={card.id}
                  data-testid={`debit-card-row-${card.id}`}
                  className="border border-border rounded-lg p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-ui font-semibold uppercase tracking-wide text-[#5B6B7A]">
                      Debit Card
                    </span>
                    <span
                      data-testid={`debit-card-status-${card.id}`}
                      className={`text-[10px] font-ui font-semibold px-2 py-0.5 rounded-full ${ACCOUNT_STATUS_CLASSES[card.status]}`}
                    >
                      {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
                    </span>
                  </div>
                  {card.status !== 'closed' && (
                    <div className="flex gap-3 pt-1 border-t border-border">
                      {card.status === 'active' && (
                        <button
                          onClick={() => debitStatusMutation.mutate({ cardId: card.id, status: 'frozen' })}
                          className="text-xs font-ui font-semibold text-status-warningText hover:opacity-80 transition-opacity"
                        >
                          Freeze
                        </button>
                      )}
                      {card.status === 'frozen' && (
                        <button
                          onClick={() => debitStatusMutation.mutate({ cardId: card.id, status: 'active' })}
                          className="text-xs font-ui font-semibold text-status-successText hover:opacity-80 transition-opacity"
                        >
                          Unfreeze
                        </button>
                      )}
                      <button
                        onClick={() => debitStatusMutation.mutate({ cardId: card.id, status: 'closed' })}
                        className="text-xs font-ui font-semibold text-status-dangerText hover:opacity-80 transition-opacity"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Credit Card */}
        <Section
          title="Credit Card"
          testId="section-credit-card"
          action={
            !hasNonClosedCreditCard && (
              <button
                type="button"
                onClick={() => {
                  setActionError('');
                  setModal({ kind: 'issue_credit' });
                }}
                className="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-ui font-semibold hover:bg-brand-deep transition-colors"
              >
                + Issue Credit Card
              </button>
            )
          }
        >
          {client.creditCards.length === 0 ? (
            <p className="text-sm text-[#8595A3]">No credit card yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {client.creditCards.map((card) => (
                <div
                  key={card.id}
                  data-testid={`credit-card-row-${card.id}`}
                  className="border border-border rounded-lg p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-ui font-semibold uppercase tracking-wide text-[#5B6B7A]">
                      Credit Card
                    </span>
                    <span
                      data-testid={`credit-card-status-${card.id}`}
                      className={`text-[10px] font-ui font-semibold px-2 py-0.5 rounded-full ${ACCOUNT_STATUS_CLASSES[card.status]}`}
                    >
                      {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs font-ui text-[#8595A3]">
                    Limit: {formatCurrency(card.creditLimit)}
                  </p>
                  <p className="font-display text-lg font-semibold tabular-nums text-[#0F172A]">
                    {formatCurrency(card.outstandingBalance)}
                  </p>
                  {card.status !== 'closed' && (
                    <div className="flex gap-3 pt-1 border-t border-border">
                      {card.status === 'active' && (
                        <button
                          onClick={() => creditStatusMutation.mutate({ cardId: card.id, status: 'frozen' })}
                          className="text-xs font-ui font-semibold text-status-warningText hover:opacity-80 transition-opacity"
                        >
                          Freeze
                        </button>
                      )}
                      {card.status === 'frozen' && (
                        <button
                          onClick={() => creditStatusMutation.mutate({ cardId: card.id, status: 'active' })}
                          className="text-xs font-ui font-semibold text-status-successText hover:opacity-80 transition-opacity"
                        >
                          Unfreeze
                        </button>
                      )}
                      <button
                        onClick={() => creditStatusMutation.mutate({ cardId: card.id, status: 'closed' })}
                        className="text-xs font-ui font-semibold text-status-dangerText hover:opacity-80 transition-opacity"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Pending Requests */}
        <Section title="Pending Requests" testId="section-pending-requests">
          {client.pendingRequests.length === 0 ? (
            <p className="text-sm text-[#8595A3]">No pending requests.</p>
          ) : (
            <ul className="divide-y divide-border">
              {client.pendingRequests.map((r) => (
                <li key={r.id} data-testid={`pending-request-${r.id}`} className="py-3 flex items-center justify-between">
                  <span className="text-sm font-ui text-[#0F172A]">{REQ_TYPE_LABELS[r.type] ?? r.type}</span>
                  <span className="text-xs font-ui text-[#8595A3]">{formatDate(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Transaction History */}
        <ClientHistorySection
          customerId={client.user.id}
          accounts={client.accounts}
          debitCards={client.debitCards}
          creditCards={client.creditCards}
        />
      </div>

      {/* Modals */}
      {modal?.kind === 'open_account' && (
        <OpenAccountModal
          submitting={openAccountMutation.isPending}
          onSubmit={(type) => openAccountMutation.mutate(type)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === 'issue_debit' && (
        <IssueDebitModal
          accounts={activeAccounts}
          submitting={issueDebitMutation.isPending}
          onSubmit={(accountId) => issueDebitMutation.mutate(accountId)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === 'issue_credit' && (
        <IssueCreditModal
          submitting={issueCreditMutation.isPending}
          onSubmit={(limit) => issueCreditMutation.mutate(limit)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === 'delete_blocked' && (
        <div
          data-testid="modal-deletion-blocked"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="bg-white rounded-xl shadow-modal w-full max-w-sm mx-4 p-6 space-y-4">
            <h3 className="font-display font-semibold text-[#0F172A] text-lg">Cannot delete client</h3>
            <p className="text-sm text-[#5B6B7A]">The following conditions must be met first:</p>
            <ul className="space-y-2">
              {modal.unmet.map((code) => (
                <li
                  key={code}
                  data-testid="msg-unmet-condition"
                  className="text-sm text-status-dangerText bg-status-dangerBg rounded px-3 py-2"
                >
                  {UNMET_LABELS[code] ?? code}
                </li>
              ))}
            </ul>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-ui font-semibold hover:bg-brand-deep transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {modal?.kind === 'confirm_delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-sm mx-4 p-6 space-y-4">
            <h3 className="font-display font-semibold text-[#0F172A] text-lg">Delete this client?</h3>
            <p className="text-sm text-[#5B6B7A]">
              This will permanently remove {client.user.fullName} and all associated records. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-ui font-semibold text-[#5B6B7A] hover:bg-tint-100 transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="btn-confirm-delete-client"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-status-dangerText text-white text-sm font-ui font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────
function Section({
  title,
  testId,
  action,
  children,
}: {
  title: string;
  testId: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-testid={testId} className="bg-white rounded-xl shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-[#0F172A] text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Open Account Modal ───────────────────────────────────────────────────────
function OpenAccountModal({
  submitting,
  onSubmit,
  onClose,
}: {
  submitting: boolean;
  onSubmit: (type: 'savings' | 'current') => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<'savings' | 'current'>('savings');
  return (
    <Modal title="Open New Account" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm font-ui text-[#5B6B7A]">Select account type</p>
        <div className="flex gap-4">
          {(['savings', 'current'] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="accountType"
                checked={type === t}
                onChange={() => setType(t)}
                className="accent-brand-primary"
              />
              <span className="text-sm font-ui text-[#0F172A] capitalize">{t}</span>
            </label>
          ))}
        </div>
      </div>
      <ModalFooter onClose={onClose} onSubmit={() => onSubmit(type)} submitting={submitting} submitLabel="Open Account" />
    </Modal>
  );
}

// ─── Issue Debit Card Modal ───────────────────────────────────────────────────
function IssueDebitModal({
  accounts,
  submitting,
  onSubmit,
  onClose,
}: {
  accounts: Account[];
  submitting: boolean;
  onSubmit: (accountId: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(accounts[0]?.id ?? '');
  return (
    <Modal title="Issue Debit Card" onClose={onClose}>
      {accounts.length === 0 ? (
        <p className="text-sm text-[#5B6B7A]">No active accounts available to link a card to.</p>
      ) : (
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full border border-border-input rounded-lg px-3 py-2 text-sm font-ui text-[#0F172A] focus:outline-none focus:border-brand-primary"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.type.charAt(0).toUpperCase() + a.type.slice(1)} — {a.iban.slice(-4)}
            </option>
          ))}
        </select>
      )}
      <ModalFooter onClose={onClose} onSubmit={() => onSubmit(selected)} submitting={submitting} disabled={!selected} />
    </Modal>
  );
}

// ─── Issue Credit Card Modal ──────────────────────────────────────────────────
function IssueCreditModal({
  submitting,
  onSubmit,
  onClose,
}: {
  submitting: boolean;
  onSubmit: (limit: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('1000');
  return (
    <Modal title="Issue Credit Card" onClose={onClose}>
      <div className="space-y-2">
        <label className="text-sm font-ui text-[#5B6B7A]">Credit limit (€)</label>
        <input
          type="number"
          min="1"
          step="100"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border border-border-input rounded-lg px-3 py-2 text-sm font-ui text-[#0F172A] focus:outline-none focus:border-brand-primary"
        />
      </div>
      <ModalFooter
        onClose={onClose}
        onSubmit={() => onSubmit(parseFloat(value))}
        submitting={submitting}
        disabled={!value || parseFloat(value) <= 0}
      />
    </Modal>
  );
}

// ─── Shared modal shell ────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-modal w-full max-w-sm mx-4 p-6 space-y-5">
        <h3 className="font-display font-semibold text-[#0F172A] text-lg">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
  onSubmit,
  submitting,
  disabled,
  submitLabel = 'Submit',
}: {
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  disabled?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-1">
      <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-ui font-semibold text-[#5B6B7A] hover:bg-tint-100 transition-colors">
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={submitting || disabled}
        className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-ui font-semibold hover:bg-brand-deep transition-colors disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : submitLabel}
      </button>
    </div>
  );
}
