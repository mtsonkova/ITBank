import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../../components/layout/AppShell';
import api from '../../lib/axios';
import { formatCurrency, formatIBAN, maskIBAN } from '../../lib/formatters';
import type { BankAccount, DebitCard, CreditCard } from '@banking-simulator/shared-types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DebitCardExt extends DebitCard {
  bankAccount: Pick<BankAccount, 'id' | 'iban' | 'type' | 'status' | 'balance'>;
}

type Tab = 'deposit' | 'transfer' | 'topup' | 'withdraw';
type TransferMode = 'same' | 'cross';

interface TopUpSource {
  id: string;
  type: 'account' | 'debit_card';
  label: string;
  balance: string;
  status: 'active' | 'frozen';
}

interface InsufficientFundsState {
  available_balance: string;
  required_amount: string;
  top_up_sources: TopUpSource[];
}

interface InstrumentOption {
  value: string; // "{type}:{id}"
  label: string;
  balance: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function apiError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response: { data: { error?: string } } }).response;
    return r.data?.error ?? 'An error occurred';
  }
  return 'An error occurred';
}

const STATUS_PILL: Record<string, string> = {
  active: 'bg-status-successBg text-status-successText',
  frozen: 'bg-status-warningBg text-status-warningText',
  closed: 'bg-status-dangerBg text-status-dangerText',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'deposit', label: 'Deposit' },
    { key: 'transfer', label: 'Transfer' },
    { key: 'topup', label: 'Top-Up' },
    { key: 'withdraw', label: 'Withdraw Request' },
  ];
  return (
    <div className="flex border-b border-gray-200 mb-6">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-5 py-3 text-sm font-ui font-semibold border-b-2 -mb-px transition-colors ${
            active === t.key
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          data-testid={`tab-${t.key}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Msg({ text, error }: { text: string; error: boolean }) {
  return (
    <p
      data-testid={error ? 'msg-error' : 'msg-success'}
      className={`mt-3 text-sm font-ui px-3 py-2 rounded ${
        error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
      }`}
    >
      {text}
    </p>
  );
}

// ─── Deposit Tab ──────────────────────────────────────────────────────────────
function DepositTab({ accounts }: { accounts: BankAccount[] }) {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  const mutation = useMutation({
    mutationFn: (body: { account_id: string; amount: number }) =>
      api.post('/api/v1/transactions/deposit', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['recentTransactions'] });
      setAmount('');
      setMsg({ text: 'Deposit successful', error: false });
    },
    onError: (err) => setMsg({ text: apiError(err), error: true }),
  });

  const activeAccounts = accounts.filter((a) => a.status === 'active');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const parsed = parseFloat(amount);
    if (!accountId || !amount || isNaN(parsed) || parsed <= 0) {
      setMsg({ text: 'Please select an account and enter a valid amount', error: true });
      return;
    }
    mutation.mutate({ account_id: accountId, amount: parsed });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">Account</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
          data-testid="deposit-account"
          required
        >
          <option value="">— select account —</option>
          {activeAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.type.charAt(0).toUpperCase() + a.type.slice(1)} {formatIBAN(a.iban)} — {formatCurrency(a.balance)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">Amount (€)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
          data-testid="deposit-amount"
        />
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="bg-brand-primary text-white px-5 py-2 rounded-lg text-sm font-ui font-semibold hover:bg-[#0096C7] disabled:opacity-60 transition-colors"
        data-testid="deposit-submit"
      >
        {mutation.isPending ? 'Processing…' : 'Deposit'}
      </button>
      {msg && <Msg text={msg.text} error={msg.error} />}
    </form>
  );
}

// ─── Insufficient Funds Panel ─────────────────────────────────────────────────
function InsufficientFundsPanel({
  data,
  onFundAndRetry,
  onDismiss,
}: {
  data: InsufficientFundsState;
  onFundAndRetry: (sourceType: string, sourceId: string, topUpAmount: number) => void;
  onDismiss: () => void;
}) {
  const [selectedSource, setSelectedSource] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');

  const activeSources = data.top_up_sources.filter((s) => s.status === 'active');
  const frozenSources = data.top_up_sources.filter((s) => s.status === 'frozen');
  const allSources = [...activeSources, ...frozenSources];

  function handleFund(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSource) return;
    const parsed = parseFloat(topUpAmount);
    if (isNaN(parsed) || parsed <= 0) return;
    const [type, id] = selectedSource.split(':');
    onFundAndRetry(type, id, parsed);
  }

  return (
    <div
      data-testid="insufficient-funds-panel"
      className="mt-4 border border-red-200 rounded-xl bg-red-50 p-4 space-y-3"
    >
      <div data-testid="insufficient-funds-warning" className="flex items-start gap-2">
        <span className="text-red-500 text-lg leading-none">⚠</span>
        <div>
          <p className="text-sm font-ui font-semibold text-red-700">Insufficient funds</p>
          <p className="text-xs font-ui text-red-600 mt-0.5">
            Available: {formatCurrency(data.available_balance)} · Required: {formatCurrency(data.required_amount)}
          </p>
        </div>
      </div>

      {allSources.length === 0 ? (
        <p className="text-xs font-ui text-red-600">No other funding sources available.</p>
      ) : (
        <form onSubmit={handleFund} className="space-y-3">
          <p className="text-xs font-ui font-semibold text-gray-700">
            Fund from another source, then retry:
          </p>
          <div className="space-y-2">
            {allSources.map((src) => {
              const val = `${src.type}:${src.id}`;
              const isFrozen = src.status === 'frozen';
              return (
                <label
                  key={src.id}
                  data-testid={`topup-source-${src.id}`}
                  className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                    isFrozen
                      ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                      : selectedSource === val
                        ? 'border-brand-primary bg-white'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="topup-source"
                    value={val}
                    disabled={isFrozen}
                    checked={selectedSource === val}
                    onChange={() => setSelectedSource(val)}
                    data-testid={`topup-radio-${src.id}`}
                    className="accent-brand-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-ui font-semibold text-gray-800 truncate">{src.label}</p>
                    <p className="text-xs font-ui text-gray-500">{formatCurrency(src.balance)}</p>
                  </div>
                  {isFrozen && (
                    <span className="text-[10px] font-ui font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                      Frozen
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {selectedSource && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="Amount (€)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
                data-testid="topup-amount"
              />
              <button
                type="submit"
                className="bg-brand-primary text-white px-4 py-1.5 rounded-lg text-sm font-ui font-semibold hover:bg-[#0096C7] transition-colors"
                data-testid="topup-submit"
              >
                Fund &amp; Retry
              </button>
            </div>
          )}
        </form>
      )}

      <button
        onClick={onDismiss}
        className="text-xs font-ui text-gray-400 hover:text-gray-600 underline"
      >
        Dismiss
      </button>
    </div>
  );
}

// ─── Transfer Tab ─────────────────────────────────────────────────────────────
function TransferTab({
  accounts,
  debitCards,
  creditCards,
}: {
  accounts: BankAccount[];
  debitCards: DebitCardExt[];
  creditCards: CreditCard[];
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<TransferMode>('same');

  // same-customer state
  const [fromVal, setFromVal] = useState('');
  const [toVal, setToVal] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [insufficientFunds, setInsufficientFunds] = useState<InsufficientFundsState | null>(null);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  // cross-customer state
  const [crossFromId, setCrossFromId] = useState('');
  const [toIban, setToIban] = useState('');
  const [crossAmount, setCrossAmount] = useState('');
  const [crossMsg, setCrossMsg] = useState<{ text: string; error: boolean } | null>(null);

  // ── Build instrument options ──────────────────────────────────────────────
  const instrumentOptions: InstrumentOption[] = [
    ...accounts
      .filter((a) => a.status === 'active')
      .map((a) => ({
        value: `account:${a.id}`,
        label: `${a.type.charAt(0).toUpperCase() + a.type.slice(1)} ${formatIBAN(a.iban)}`,
        balance: a.balance,
        status: a.status,
      })),
    ...debitCards
      .filter((c) => c.status === 'active' && c.bankAccount.status === 'active')
      .map((c) => ({
        value: `debit_card:${c.id}`,
        label: `Debit ${maskIBAN(c.bankAccount.iban)}`,
        balance: c.bankAccount.balance,
        status: c.status,
      })),
    ...creditCards
      .filter((c) => c.status === 'active')
      .map((c) => ({
        value: `credit_card:${c.id}`,
        label: `Credit Card`,
        balance: c.outstandingBalance,
        status: c.status,
      })),
  ];

  const toOptions = instrumentOptions.filter((o) => o.value !== fromVal);
  const activeAccounts = accounts.filter((a) => a.status === 'active');

  // ── Mutations ─────────────────────────────────────────────────────────────
  const transferMutation = useMutation({
    mutationFn: (body: {
      from_type: string;
      from_id: string;
      to_type: string;
      to_id: string;
      amount: number;
      note?: string;
    }) => api.post('/api/v1/transactions/transfer', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['debitCards'] });
      void qc.invalidateQueries({ queryKey: ['creditCards'] });
      void qc.invalidateQueries({ queryKey: ['recentTransactions'] });
      setInsufficientFunds(null);
      setAmount('');
      setNote('');
      setFromVal('');
      setToVal('');
      setMsg({ text: 'Transfer successful', error: false });
    },
    onError: (err: unknown) => {
      const r = (err as { response?: { data?: { code?: string; available_balance?: string; required_amount?: string; top_up_sources?: TopUpSource[] } } }).response;
      if (r?.data?.code === 'INSUFFICIENT_FUNDS') {
        setInsufficientFunds({
          available_balance: r.data.available_balance ?? '0',
          required_amount: r.data.required_amount ?? '0',
          top_up_sources: r.data.top_up_sources ?? [],
        });
        setMsg(null);
      } else {
        setMsg({ text: apiError(err), error: true });
        setInsufficientFunds(null);
      }
    },
  });

  const fundMutation = useMutation({
    mutationFn: (body: {
      from_type: string;
      from_id: string;
      to_type: string;
      to_id: string;
      amount: number;
    }) => api.post('/api/v1/transactions/transfer', body).then((r) => r.data),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      // retry original transfer
      const [fromType, fromId] = fromVal.split(':');
      const [toType, toId] = toVal.split(':');
      const parsed = parseFloat(amount);
      setInsufficientFunds(null);
      void qc.invalidateQueries({ queryKey: ['debitCards'] });
      transferMutation.mutate({ from_type: fromType, from_id: fromId, to_type: toType, to_id: toId, amount: parsed, note: note || undefined });
      void variables; // suppress unused warning
    },
    onError: (err) => setMsg({ text: `Funding failed: ${apiError(err)}`, error: true }),
  });

  const externalMutation = useMutation({
    mutationFn: (body: { from_account_id: string; to_iban: string; amount: number }) =>
      api.post('/api/v1/transactions/transfer/external', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['recentTransactions'] });
      setCrossFromId('');
      setToIban('');
      setCrossAmount('');
      setCrossMsg({ text: 'Transfer successful', error: false });
    },
    onError: (err) => setCrossMsg({ text: apiError(err), error: true }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleSameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setInsufficientFunds(null);
    const parsed = parseFloat(amount);
    if (!fromVal || !toVal || !amount || isNaN(parsed) || parsed <= 0) {
      setMsg({ text: 'Please fill in all fields', error: true });
      return;
    }
    const [fromType, fromId] = fromVal.split(':');
    const [toType, toId] = toVal.split(':');
    transferMutation.mutate({ from_type: fromType, from_id: fromId, to_type: toType, to_id: toId, amount: parsed, note: note || undefined });
  }

  function handleFundAndRetry(sourceType: string, sourceId: string, topUpAmt: number) {
    const [, fromId] = fromVal.split(':');
    const [fromType] = fromVal.split(':');
    fundMutation.mutate({
      from_type: sourceType,
      from_id: sourceId,
      to_type: fromType,
      to_id: fromId,
      amount: topUpAmt,
    });
  }

  function handleSimulateInsufficient() {
    setInsufficientFunds({
      available_balance: '0.00',
      required_amount: amount || '100.00',
      top_up_sources: instrumentOptions
        .filter((o) => o.value !== fromVal)
        .map((o) => {
          const [type, id] = o.value.split(':');
          if (type === 'credit_card') return null;
          return { id, type: type as 'account' | 'debit_card', label: o.label, balance: o.balance, status: 'active' as const };
        })
        .filter(Boolean) as TopUpSource[],
    });
  }

  function handleCrossSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCrossMsg(null);
    const parsed = parseFloat(crossAmount);
    if (!crossFromId || !toIban || isNaN(parsed) || parsed <= 0) {
      setCrossMsg({ text: 'Please fill in all fields', error: true });
      return;
    }
    externalMutation.mutate({ from_account_id: crossFromId, to_iban: toIban, amount: parsed });
  }

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex gap-2 mb-5">
        {(['same', 'cross'] as TransferMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setMsg(null); setCrossMsg(null); setInsufficientFunds(null); }}
            className={`px-4 py-1.5 rounded-full text-sm font-ui font-semibold border transition-colors ${
              mode === m
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
            data-testid={`transfer-mode-${m}`}
          >
            {m === 'same' ? 'Same Customer' : 'Cross-Customer'}
          </button>
        ))}
      </div>

      {/* Same-customer form */}
      {mode === 'same' && (
        <form onSubmit={handleSameSubmit} className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">From</label>
            <select
              value={fromVal}
              onChange={(e) => { setFromVal(e.target.value); setToVal(''); setInsufficientFunds(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
              data-testid="transfer-from"
              required
            >
              <option value="">— select source —</option>
              {instrumentOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — {formatCurrency(o.balance)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">To</label>
            <select
              value={toVal}
              onChange={(e) => setToVal(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
              data-testid="transfer-to"
              required
            >
              <option value="">— select destination —</option>
              {toOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — {formatCurrency(o.balance)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">Amount (€)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
              data-testid="transfer-amount"
            />
          </div>
          <div>
            <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
              maxLength={120}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
              data-testid="transfer-note"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={transferMutation.isPending || fundMutation.isPending}
              className="bg-brand-primary text-white px-5 py-2 rounded-lg text-sm font-ui font-semibold hover:bg-[#0096C7] disabled:opacity-60 transition-colors"
              data-testid="transfer-submit"
            >
              {transferMutation.isPending || fundMutation.isPending ? 'Processing…' : 'Transfer'}
            </button>
            <button
              type="button"
              onClick={handleSimulateInsufficient}
              className="px-4 py-2 rounded-lg text-sm font-ui font-semibold border border-gray-300 text-gray-600 hover:border-gray-400 transition-colors"
              data-testid="transfer-simulate-insufficient"
            >
              Simulate Insufficient
            </button>
          </div>
          {msg && <Msg text={msg.text} error={msg.error} />}
          {insufficientFunds && (
            <InsufficientFundsPanel
              data={insufficientFunds}
              onFundAndRetry={handleFundAndRetry}
              onDismiss={() => setInsufficientFunds(null)}
            />
          )}
        </form>
      )}

      {/* Cross-customer form */}
      {mode === 'cross' && (
        <form onSubmit={handleCrossSubmit} className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">From Account</label>
            <select
              value={crossFromId}
              onChange={(e) => setCrossFromId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
              data-testid="transfer-from"
              required
            >
              <option value="">— select account —</option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.type.charAt(0).toUpperCase() + a.type.slice(1)} {formatIBAN(a.iban)} — {formatCurrency(a.balance)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">Destination IBAN</label>
            <input
              type="text"
              value={toIban}
              onChange={(e) => setToIban(e.target.value)}
              placeholder="IB12 XXXX XXXX XXXX XXXX"
              maxLength={25}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary tracking-wider"
              data-testid="transfer-to"
            />
          </div>
          <div>
            <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">Amount (€)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={crossAmount}
              onChange={(e) => setCrossAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
              data-testid="transfer-amount"
            />
          </div>
          <button
            type="submit"
            disabled={externalMutation.isPending}
            className="bg-brand-primary text-white px-5 py-2 rounded-lg text-sm font-ui font-semibold hover:bg-[#0096C7] disabled:opacity-60 transition-colors"
            data-testid="transfer-submit"
          >
            {externalMutation.isPending ? 'Processing…' : 'Send'}
          </button>
          {crossMsg && <Msg text={crossMsg.text} error={crossMsg.error} />}
        </form>
      )}
    </div>
  );
}

// ─── Top-Up Tab ───────────────────────────────────────────────────────────────
function TopUpTab({
  accounts,
  debitCards,
  creditCards,
}: {
  accounts: BankAccount[];
  debitCards: DebitCardExt[];
  creditCards: CreditCard[];
}) {
  const qc = useQueryClient();
  const [fromType, setFromType] = useState<'account' | 'debit_card'>('account');
  const [fromId, setFromId] = useState('');
  const [toCreditCardId, setToCreditCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  const mutation = useMutation({
    mutationFn: (body: { from_type: string; from_id: string; to_card_id: string; amount: number }) =>
      api.post('/api/v1/transactions/topup', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['debitCards'] });
      void qc.invalidateQueries({ queryKey: ['creditCards'] });
      void qc.invalidateQueries({ queryKey: ['recentTransactions'] });
      setFromId('');
      setToCreditCardId('');
      setAmount('');
      setMsg({ text: 'Top-up successful', error: false });
    },
    onError: (err) => setMsg({ text: apiError(err), error: true }),
  });

  const activeAccounts = accounts.filter((a) => a.status === 'active');
  const activeDebitCards = debitCards.filter((c) => c.status === 'active' && c.bankAccount.status === 'active');
  const activeCreditCards = creditCards.filter((c) => c.status === 'active');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const parsed = parseFloat(amount);
    if (!fromId || !toCreditCardId || !amount || isNaN(parsed) || parsed <= 0) {
      setMsg({ text: 'Please fill in all fields', error: true });
      return;
    }
    mutation.mutate({ from_type: fromType, from_id: fromId, to_card_id: toCreditCardId, amount: parsed });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-ui font-semibold text-gray-700 mb-2">Source Type</label>
        <div className="flex gap-4">
          {(['account', 'debit_card'] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="topup-from-type"
                checked={fromType === t}
                onChange={() => { setFromType(t); setFromId(''); }}
                className="accent-brand-primary"
              />
              <span className="text-sm font-ui text-gray-700">
                {t === 'account' ? 'Account' : 'Debit Card'}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">
          {fromType === 'account' ? 'Account' : 'Debit Card'}
        </label>
        <select
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
          data-testid="topup-from"
          required
        >
          <option value="">— select —</option>
          {fromType === 'account'
            ? activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.type.charAt(0).toUpperCase() + a.type.slice(1)} {formatIBAN(a.iban)} — {formatCurrency(a.balance)}
                </option>
              ))
            : activeDebitCards.map((c) => (
                <option key={c.id} value={c.id}>
                  Debit {maskIBAN(c.bankAccount.iban)} — {formatCurrency(c.bankAccount.balance)}
                </option>
              ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">Credit Card</label>
        <select
          value={toCreditCardId}
          onChange={(e) => setToCreditCardId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
          data-testid="topup-to-card"
          required
        >
          <option value="">— select credit card —</option>
          {activeCreditCards.map((c) => (
            <option key={c.id} value={c.id}>
              Credit Card — {formatCurrency(c.outstandingBalance)} outstanding
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">Amount (€)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
          data-testid="topup-amount"
        />
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="bg-brand-primary text-white px-5 py-2 rounded-lg text-sm font-ui font-semibold hover:bg-[#0096C7] disabled:opacity-60 transition-colors"
        data-testid="topup-submit"
      >
        {mutation.isPending ? 'Processing…' : 'Top Up'}
      </button>
      {msg && <Msg text={msg.text} error={msg.error} />}
    </form>
  );
}

// ─── Withdraw Request Tab ─────────────────────────────────────────────────────
function WithdrawRequestTab({ accounts }: { accounts: BankAccount[] }) {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  const mutation = useMutation({
    mutationFn: (body: { type: string; payload: { account_id: string; amount: number } }) =>
      api.post('/api/v1/requests', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['requests'] });
      setAccountId('');
      setAmount('');
      setMsg({ text: 'Withdrawal request submitted — your account manager will process it', error: false });
    },
    onError: (err) => setMsg({ text: apiError(err), error: true }),
  });

  const activeAccounts = accounts.filter((a) => a.status === 'active');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const parsed = parseFloat(amount);
    if (!accountId || !amount || isNaN(parsed) || parsed <= 0) {
      setMsg({ text: 'Please select an account and enter a valid amount', error: true });
      return;
    }
    mutation.mutate({ type: 'withdraw_money', payload: { account_id: accountId, amount: parsed } });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <p className="text-sm font-ui text-gray-500">
        Request a cash withdrawal from one of your accounts. Your account manager will process the request.
      </p>
      <div>
        <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">Account</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
          data-testid="withdraw-account"
          required
        >
          <option value="">— select account —</option>
          {activeAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.type.charAt(0).toUpperCase() + a.type.slice(1)} {formatIBAN(a.iban)} — {formatCurrency(a.balance)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">Amount (€)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
          data-testid="withdraw-amount"
        />
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="bg-brand-primary text-white px-5 py-2 rounded-lg text-sm font-ui font-semibold hover:bg-[#0096C7] disabled:opacity-60 transition-colors"
        data-testid="withdraw-submit"
      >
        {mutation.isPending ? 'Submitting…' : 'Submit Request'}
      </button>
      {msg && <Msg text={msg.text} error={msg.error} />}
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TransferPage() {
  const [activeTab, setActiveTab] = useState<Tab>('deposit');

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ data: BankAccount[] }>('/api/v1/accounts').then((r) => r.data.data),
  });

  const { data: debitCardsData } = useQuery({
    queryKey: ['debitCards'],
    queryFn: () =>
      api.get<{ data: DebitCardExt[] }>('/api/v1/cards/debit').then((r) => r.data.data),
  });

  const { data: creditCardsData } = useQuery({
    queryKey: ['creditCards'],
    queryFn: () =>
      api.get<{ data: CreditCard[] }>('/api/v1/cards/credit').then((r) => r.data.data),
  });

  const accounts = accountsData ?? [];
  const debitCards = debitCardsData ?? [];
  const creditCards = creditCardsData ?? [];

  return (
    <AppShell pageTitle="Transfer & Pay">
      <div data-testid="screen-transfer" className="p-6">
        <h1 className="font-display text-2xl font-bold text-[#0F172A] mb-1">Transfer &amp; Pay</h1>
        <p className="text-sm font-ui text-gray-500 mb-6">Deposit, transfer, top up your credit card or request a withdrawal.</p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <TabBar active={activeTab} onChange={setActiveTab} />

          {activeTab === 'deposit' && <DepositTab accounts={accounts} />}
          {activeTab === 'transfer' && (
            <TransferTab accounts={accounts} debitCards={debitCards} creditCards={creditCards} />
          )}
          {activeTab === 'topup' && (
            <TopUpTab accounts={accounts} debitCards={debitCards} creditCards={creditCards} />
          )}
          {activeTab === 'withdraw' && <WithdrawRequestTab accounts={accounts} />}
        </div>

        {/* Status pill reference (hidden, for styling) */}
        {Object.entries(STATUS_PILL).map(([k]) => (
          <span key={k} className="hidden" />
        ))}
      </div>
    </AppShell>
  );
}
