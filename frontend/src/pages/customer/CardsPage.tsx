import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AppShell } from '../../components/layout/AppShell';
import api from '../../lib/axios';
import { formatCurrency, maskIBAN, formatDate } from '../../lib/formatters';
import type { BankAccount, DebitCard, CreditCard, Request } from '@banking-simulator/shared-types';

// ─── Extended type for debit card (includes bankAccount from API) ──────────────
interface DebitCardExt extends DebitCard {
  bankAccount: Pick<BankAccount, 'id' | 'iban' | 'type' | 'status' | 'balance'>;
}

// ─── Modal types ──────────────────────────────────────────────────────────────
type ModalKind =
  | { kind: 'issue_debit'; accounts: BankAccount[] }
  | { kind: 'limit'; reqType: 'increase_credit_limit' | 'decrease_credit_limit'; cardId: string }
  | { kind: 'topup'; creditCardId: string; accounts: BankAccount[]; debitCards: DebitCardExt[] }
  | null;

// ─── Request type groups ──────────────────────────────────────────────────────
const CARD_REQ_TYPES = new Set([
  'issue_debit_card',
  'close_debit_card',
  'freeze_debit_card',
  'unfreeze_debit_card',
  'issue_credit_card',
  'close_credit_card',
  'freeze_credit_card',
  'unfreeze_credit_card',
  'increase_credit_limit',
  'decrease_credit_limit',
]);

const REQ_TYPE_LABELS: Record<string, string> = {
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

function hasPendingReq(
  requests: Request[],
  type: string,
  payloadKey: string,
  payloadValue: string,
) {
  return requests.some(
    (r) =>
      r.type === type &&
      r.status === 'pending' &&
      (r.payload as Record<string, unknown>)[payloadKey] === payloadValue,
  );
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────
const fetchAccounts = () =>
  api.get<{ data: BankAccount[] }>('/api/v1/accounts').then((r) => r.data.data);

const fetchDebitCards = () =>
  api.get<{ data: DebitCardExt[] }>('/api/v1/cards/debit').then((r) => r.data.data);

const fetchCreditCards = () =>
  api.get<{ data: CreditCard[] }>('/api/v1/cards/credit').then((r) => r.data.data);

const fetchRequests = () =>
  api.get<{ data: Request[] }>('/api/v1/requests').then((r) => r.data.data);

// ─── Component ────────────────────────────────────────────────────────────────
export default function CardsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalKind>(null);

  // Per-card inline feedback
  const [actionMsg, setActionMsg] = useState<{ id: string; text: string; error: boolean } | null>(
    null,
  );

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts });
  const { data: debitCards = [] } = useQuery({ queryKey: ['debitCards'], queryFn: fetchDebitCards });
  const { data: creditCards = [] } = useQuery({ queryKey: ['creditCards'], queryFn: fetchCreditCards });
  const { data: allRequests = [] } = useQuery({ queryKey: ['requests'], queryFn: fetchRequests });

  const cardRequests = allRequests.filter((r) => CARD_REQ_TYPES.has(r.type));

  const createReq = useMutation({
    mutationFn: (body: { type: string; payload?: Record<string, unknown> }) =>
      api.post('/api/v1/requests', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] });
    },
  });

  const cancelReq = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/requests/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  });

  const topupMutation = useMutation({
    mutationFn: (body: {
      from_type: 'account' | 'debit_card';
      from_id: string;
      to_card_id: string;
      amount: number;
    }) => api.post('/api/v1/transactions/topup', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['debitCards'] });
      qc.invalidateQueries({ queryKey: ['creditCards'] });
      qc.invalidateQueries({ queryKey: ['recentTransactions'] });
    },
  });

  async function handleCardAction(type: string, payload: Record<string, unknown>, cardId: string) {
    setActionMsg(null);
    try {
      await createReq.mutateAsync({ type, payload });
      setActionMsg({ id: cardId, text: 'Request submitted successfully.', error: false });
    } catch (err) {
      setActionMsg({ id: cardId, text: apiError(err), error: true });
    }
  }

  const activeAccounts = accounts.filter((a) => a.status === 'active');
  const hasNonClosedCreditCard = creditCards.some((c) => c.status !== 'closed');

  return (
    <AppShell pageTitle="Cards">
      <div className="space-y-6">

        {/* ── Debit Cards ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-[#0F172A] text-lg">Debit Cards</h2>
            <button
              onClick={() => setModal({ kind: 'issue_debit', accounts })}
              disabled={activeAccounts.length === 0}
              className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-ui font-semibold hover:bg-brand-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Request New Card
            </button>
          </div>

          {debitCards.length === 0 ? (
            <p className="text-sm text-[#8595A3]">No debit cards yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {debitCards.map((card) => (
                <DebitCardTile
                  key={card.id}
                  card={card}
                  requests={cardRequests}
                  submitting={createReq.isPending}
                  onAction={handleCardAction}
                  feedback={actionMsg?.id === card.id ? actionMsg : null}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Credit Card ───────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-[#0F172A] text-lg">Credit Card</h2>
            {!hasNonClosedCreditCard && (
              <button
                onClick={() => handleCardAction('issue_credit_card', {}, 'credit')}
                disabled={createReq.isPending}
                className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-ui font-semibold hover:bg-brand-deep transition-colors disabled:opacity-40"
              >
                + Request Credit Card
              </button>
            )}
          </div>

          {creditCards.length === 0 ? (
            <p className="text-sm text-[#8595A3]">No credit card yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {creditCards.map((card) => (
                <CreditCardTile
                  key={card.id}
                  card={card}
                  requests={cardRequests}
                  submitting={createReq.isPending}
                  onAction={handleCardAction}
                  onTopUp={() =>
                    setModal({
                      kind: 'topup',
                      creditCardId: card.id,
                      accounts,
                      debitCards,
                    })
                  }
                  onLimitRequest={(reqType) =>
                    setModal({ kind: 'limit', reqType, cardId: card.id })
                  }
                  feedback={actionMsg?.id === card.id ? actionMsg : null}
                />
              ))}
            </div>
          )}

          {/* Credit issue feedback (no card ID key) */}
          {actionMsg?.id === 'credit' && (
            <p
              data-testid={actionMsg.error ? 'msg-error' : 'msg-success'}
              className={`mt-2 text-sm font-ui ${actionMsg.error ? 'text-status-errorText' : 'text-status-successText'}`}
            >
              {actionMsg.text}
            </p>
          )}
        </section>

        {/* ── Card Requests Table ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-card p-5">
          <h2 className="font-display font-semibold text-[#0F172A] mb-4">Card Requests</h2>
          {cardRequests.length === 0 ? (
            <p className="text-sm text-[#8595A3]">No card requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-ui">
                <thead>
                  <tr className="border-b border-border text-left">
                    {['Request', 'Submitted', 'Status', 'Action'].map((h) => (
                      <th
                        key={h}
                        className="pb-3 pr-6 text-xs font-semibold uppercase tracking-wide text-[#5B6B7A]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cardRequests.map((req) => (
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
                            onClick={() => cancelReq.mutate(req.id)}
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

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {modal?.kind === 'issue_debit' && (
        <IssueDebitModal
          accounts={modal.accounts.filter((a) => a.status === 'active')}
          submitting={createReq.isPending}
          onSubmit={async (accountId) => {
            try {
              await createReq.mutateAsync({
                type: 'issue_debit_card',
                payload: { account_id: accountId },
              });
              setModal(null);
            } catch (err) {
              alert(apiError(err));
            }
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === 'limit' && (
        <LimitModal
          reqType={modal.reqType}
          cardId={modal.cardId}
          submitting={createReq.isPending}
          onSubmit={async (newLimit) => {
            try {
              await createReq.mutateAsync({
                type: modal.reqType,
                payload: { card_id: modal.cardId, new_limit: newLimit },
              });
              setModal(null);
            } catch (err) {
              alert(apiError(err));
            }
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === 'topup' && (
        <TopUpModal
          creditCardId={modal.creditCardId}
          accounts={modal.accounts}
          debitCards={modal.debitCards}
          submitting={topupMutation.isPending}
          onSubmit={async (fromType, fromId, amount) => {
            try {
              await topupMutation.mutateAsync({
                from_type: fromType,
                from_id: fromId,
                to_card_id: modal.creditCardId,
                amount,
              });
              setModal(null);
            } catch (err) {
              alert(apiError(err));
            }
          }}
          onClose={() => setModal(null)}
        />
      )}
    </AppShell>
  );
}

// ─── Debit Card Tile ──────────────────────────────────────────────────────────
function DebitCardTile({
  card,
  requests,
  submitting,
  onAction,
  feedback,
}: {
  card: DebitCardExt;
  requests: Request[];
  submitting: boolean;
  onAction: (type: string, payload: Record<string, unknown>, id: string) => void;
  feedback: { text: string; error: boolean } | null;
}) {
  const cardId = card.id;
  const hasPendingFreeze = hasPendingReq(requests, 'freeze_debit_card', 'card_id', cardId);
  const hasPendingUnfreeze = hasPendingReq(requests, 'unfreeze_debit_card', 'card_id', cardId);
  const hasPendingClose = hasPendingReq(requests, 'close_debit_card', 'card_id', cardId);

  return (
    <div
      data-testid={`card-tile-${cardId}`}
      className="rounded-xl shadow-card overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0077B6, #00B4D8)' }}
    >
      {/* Card face */}
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-ui font-semibold uppercase tracking-widest text-white/70">
              {card.bankAccount.type === 'savings' ? 'Savings' : 'Current'} Debit
            </p>
          </div>
          <span
            data-testid={`card-status-${cardId}`}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              card.status === 'active'
                ? 'bg-white/20 text-white'
                : card.status === 'frozen'
                  ? 'bg-amber-500/30 text-amber-100'
                  : 'bg-black/30 text-white/60'
            }`}
          >
            {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
          </span>
        </div>
        <p className="font-mono text-sm text-white/90 tracking-widest">
          {maskIBAN(card.bankAccount.iban)}
        </p>
        <p className="text-xs font-ui text-white/60 mt-1">
          Linked to: {card.bankAccount.type} account
        </p>
      </div>

      {/* Actions */}
      {card.status !== 'closed' && (
        <div className="bg-black/20 px-4 py-3 flex flex-wrap gap-2">
          {card.status === 'active' && (
            <button
              data-testid={`account-freeze-${cardId}`}
              onClick={() => onAction('freeze_debit_card', { card_id: cardId }, cardId)}
              disabled={hasPendingFreeze || submitting}
              className="text-xs font-ui font-semibold text-white/90 hover:text-white disabled:opacity-40 transition-colors"
            >
              Freeze
            </button>
          )}
          {card.status === 'frozen' && (
            <button
              onClick={() => onAction('unfreeze_debit_card', { card_id: cardId }, cardId)}
              disabled={hasPendingUnfreeze || submitting}
              className="text-xs font-ui font-semibold text-white/90 hover:text-white disabled:opacity-40 transition-colors"
            >
              Unfreeze
            </button>
          )}
          <button
            onClick={() => onAction('close_debit_card', { card_id: cardId }, cardId)}
            disabled={hasPendingClose || submitting}
            className="text-xs font-ui font-semibold text-white/60 hover:text-white disabled:opacity-40 transition-colors"
          >
            Request Close
          </button>
        </div>
      )}

      {feedback && (
        <div className="px-4 pb-3">
          <p
            data-testid={feedback.error ? 'msg-error' : 'msg-success'}
            className={`text-xs font-ui ${feedback.error ? 'text-red-200' : 'text-green-200'}`}
          >
            {feedback.text}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Credit Card Tile ─────────────────────────────────────────────────────────
function CreditCardTile({
  card,
  requests,
  submitting,
  onAction,
  onTopUp,
  onLimitRequest,
  feedback,
}: {
  card: CreditCard;
  requests: Request[];
  submitting: boolean;
  onAction: (type: string, payload: Record<string, unknown>, id: string) => void;
  onTopUp: () => void;
  onLimitRequest: (type: 'increase_credit_limit' | 'decrease_credit_limit') => void;
  feedback: { text: string; error: boolean } | null;
}) {
  const cardId = card.id;
  const outstanding = parseFloat(card.outstandingBalance);
  const isOverdraft = outstanding < 0;

  const hasPendingFreeze = hasPendingReq(requests, 'freeze_credit_card', 'card_id', cardId);
  const hasPendingUnfreeze = hasPendingReq(requests, 'unfreeze_credit_card', 'card_id', cardId);
  const hasPendingClose = hasPendingReq(requests, 'close_credit_card', 'card_id', cardId);

  return (
    <div
      data-testid={`card-tile-${cardId}`}
      className="rounded-xl shadow-card overflow-hidden flex flex-col"
      style={{ background: '#0F172A' }}
    >
      {/* Card face */}
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between mb-6">
          <p className="text-[10px] font-ui font-semibold uppercase tracking-widest text-white/60">
            Credit Card
          </p>
          <span
            data-testid={`card-status-${cardId}`}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              card.status === 'active'
                ? 'bg-white/10 text-white/80'
                : card.status === 'frozen'
                  ? 'bg-amber-500/30 text-amber-200'
                  : 'bg-white/5 text-white/40'
            }`}
          >
            {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
          </span>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-ui text-white/50 uppercase tracking-wide">
              Outstanding Balance
            </p>
            <p
              data-testid="credit-balance"
              className={`font-display text-2xl font-semibold tabular-nums ${isOverdraft ? 'text-[#FFB4A8]' : 'text-white'}`}
            >
              {formatCurrency(card.outstandingBalance)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-ui text-white/50 uppercase tracking-wide">
              Credit Limit
            </p>
            <p className="text-sm font-display font-semibold text-white/80 tabular-nums">
              {formatCurrency(card.creditLimit)}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {card.status !== 'closed' && (
        <div className="bg-white/5 px-4 py-3 flex flex-wrap gap-3">
          {card.status === 'active' && (
            <>
              <button
                data-testid={`account-freeze-${cardId}`}
                onClick={() => onAction('freeze_credit_card', { card_id: cardId }, cardId)}
                disabled={hasPendingFreeze || submitting}
                className="text-xs font-ui font-semibold text-white/70 hover:text-white disabled:opacity-40 transition-colors"
              >
                Freeze
              </button>
              <button
                onClick={onTopUp}
                className="text-xs font-ui font-semibold text-brand-light hover:text-white transition-colors"
              >
                Top Up
              </button>
            </>
          )}
          {card.status === 'frozen' && (
            <button
              onClick={() => onAction('unfreeze_credit_card', { card_id: cardId }, cardId)}
              disabled={hasPendingUnfreeze || submitting}
              className="text-xs font-ui font-semibold text-white/70 hover:text-white disabled:opacity-40 transition-colors"
            >
              Unfreeze
            </button>
          )}
          <button
            onClick={() => onAction('close_credit_card', { card_id: cardId }, cardId)}
            disabled={hasPendingClose || submitting}
            className="text-xs font-ui font-semibold text-white/40 hover:text-white/70 disabled:opacity-40 transition-colors"
          >
            Request Close
          </button>
          <button
            onClick={() => onLimitRequest('increase_credit_limit')}
            className="text-xs font-ui font-semibold text-white/70 hover:text-white transition-colors"
          >
            ↑ Increase Limit
          </button>
          <button
            onClick={() => onLimitRequest('decrease_credit_limit')}
            className="text-xs font-ui font-semibold text-white/70 hover:text-white transition-colors"
          >
            ↓ Decrease Limit
          </button>
        </div>
      )}

      {feedback && (
        <div className="px-4 pb-3">
          <p
            data-testid={feedback.error ? 'msg-error' : 'msg-success'}
            className={`text-xs font-ui ${feedback.error ? 'text-red-300' : 'text-green-300'}`}
          >
            {feedback.text}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Issue Debit Card Modal ───────────────────────────────────────────────────
function IssueDebitModal({
  accounts,
  submitting,
  onSubmit,
  onClose,
}: {
  accounts: BankAccount[];
  submitting: boolean;
  onSubmit: (accountId: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(accounts[0]?.id ?? '');

  return (
    <Modal title="Request New Debit Card" onClose={onClose}>
      {accounts.length === 0 ? (
        <p className="text-sm text-[#5B6B7A]">No active accounts available to link a card to.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-ui text-[#5B6B7A]">Select the account to link</p>
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
        </div>
      )}
      <ModalFooter
        onClose={onClose}
        onSubmit={() => onSubmit(selected)}
        submitting={submitting}
        disabled={!selected}
      />
    </Modal>
  );
}

// ─── Limit Change Modal ───────────────────────────────────────────────────────
function LimitModal({
  reqType,
  submitting,
  onSubmit,
  onClose,
}: {
  reqType: 'increase_credit_limit' | 'decrease_credit_limit';
  cardId: string;
  submitting: boolean;
  onSubmit: (newLimit: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const label = reqType === 'increase_credit_limit' ? 'Increase' : 'Decrease';

  return (
    <Modal title={`Request Credit Limit ${label}`} onClose={onClose}>
      <div className="space-y-2">
        <label className="text-sm font-ui text-[#5B6B7A]">New credit limit (€)</label>
        <input
          type="number"
          min="1"
          step="100"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 3000"
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

// ─── Top-Up Modal ─────────────────────────────────────────────────────────────
function TopUpModal({
  accounts,
  debitCards,
  submitting,
  onSubmit,
  onClose,
}: {
  creditCardId: string;
  accounts: BankAccount[];
  debitCards: DebitCardExt[];
  submitting: boolean;
  onSubmit: (fromType: 'account' | 'debit_card', fromId: string, amount: number) => void;
  onClose: () => void;
}) {
  const [fromType, setFromType] = useState<'account' | 'debit_card'>('account');
  const [fromId, setFromId] = useState('');
  const [amount, setAmount] = useState('');

  const activeAccounts = accounts.filter((a) => a.status === 'active');
  const activeDebitCards = debitCards.filter(
    (c) => c.status === 'active' && c.bankAccount.status === 'active',
  );

  const sources = fromType === 'account' ? activeAccounts : activeDebitCards;

  // Reset fromId when type changes
  function handleTypeChange(t: 'account' | 'debit_card') {
    setFromType(t);
    setFromId('');
  }

  const selectedId = fromId || sources[0]?.id || '';

  function sourceLabel(source: BankAccount | DebitCardExt) {
    if ('bankAccount' in source) {
      // DebitCardExt
      return `Debit card — ${source.bankAccount.type} (${source.bankAccount.iban.slice(-4)}) · ${formatCurrency(source.bankAccount.balance)}`;
    }
    return `${source.type.charAt(0).toUpperCase() + source.type.slice(1)} account — ${source.iban.slice(-4)} · ${formatCurrency(source.balance)}`;
  }

  return (
    <Modal title="Top Up Credit Card" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-ui text-[#5B6B7A]">Source</p>
          <div className="flex gap-4">
            {(['account', 'debit_card'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="topupFrom"
                  checked={fromType === t}
                  onChange={() => handleTypeChange(t)}
                  className="accent-brand-primary"
                />
                <span className="text-sm font-ui capitalize">
                  {t === 'debit_card' ? 'Debit card' : 'Account'}
                </span>
              </label>
            ))}
          </div>
          {sources.length === 0 ? (
            <p className="text-xs text-status-dangerText">No active sources available.</p>
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setFromId(e.target.value)}
              className="w-full border border-border-input rounded-lg px-3 py-2 text-sm font-ui text-[#0F172A] focus:outline-none focus:border-brand-primary"
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {sourceLabel(s)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-ui text-[#5B6B7A]">Amount (€)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full border border-border-input rounded-lg px-3 py-2 text-sm font-ui text-[#0F172A] focus:outline-none focus:border-brand-primary"
          />
        </div>
      </div>

      <ModalFooter
        onClose={onClose}
        onSubmit={() => onSubmit(fromType, selectedId, parseFloat(amount))}
        submitting={submitting}
        submitLabel="Top Up"
        disabled={!selectedId || !amount || parseFloat(amount) <= 0 || sources.length === 0}
      />
    </Modal>
  );
}

// ─── Shared Modal shell ───────────────────────────────────────────────────────
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
  submitLabel = 'Submit Request',
}: {
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  disabled?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-1">
      <button
        onClick={onClose}
        className="px-4 py-2 rounded-lg text-sm font-ui font-semibold text-[#5B6B7A] hover:bg-tint-100 transition-colors"
      >
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
