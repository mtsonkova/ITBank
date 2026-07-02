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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function apiError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response: { data: { error?: string } } }).response;
    return r.data?.error ?? 'An error occurred';
  }
  return 'An error occurred';
}

// ─── Insufficient Funds Panel ─────────────────────────────────────────────────
function InsufficientFundsPanel({
  data,
  sourceType,
  sourceId,
  onFundAndRetry,
  onDismiss,
}: {
  data: InsufficientFundsState;
  sourceType: string;
  sourceId: string;
  onFundAndRetry: (src: TopUpSource, topUpAmt: number) => void;
  onDismiss: () => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');

  void sourceType;
  void sourceId;

  const activeSources = data.top_up_sources.filter((s) => s.status === 'active');
  const frozenSources = data.top_up_sources.filter((s) => s.status === 'frozen');
  const allSources = [...activeSources, ...frozenSources];

  const selectedSrc = allSources.find((s) => s.id === selectedId);

  function handleFund(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSrc) return;
    const parsed = parseFloat(topUpAmount);
    if (isNaN(parsed) || parsed <= 0) return;
    onFundAndRetry(selectedSrc, parsed);
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
              const isFrozen = src.status === 'frozen';
              return (
                <label
                  key={src.id}
                  data-testid={`topup-source-${src.id}`}
                  className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                    isFrozen
                      ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                      : selectedId === src.id
                        ? 'border-brand-primary bg-white'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="spend-topup-source"
                    value={src.id}
                    disabled={isFrozen}
                    checked={selectedId === src.id}
                    onChange={() => setSelectedId(src.id)}
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

          {selectedId && (
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SpendPage() {
  const qc = useQueryClient();

  const [instrumentVal, setInstrumentVal] = useState(''); // "{type}:{id}"
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [insufficientFunds, setInsufficientFunds] = useState<InsufficientFundsState | null>(null);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ data: BankAccount[] }>('/api/v1/accounts').then((r) => r.data.data),
  });

  const { data: debitCards = [] } = useQuery({
    queryKey: ['debitCards'],
    queryFn: () =>
      api.get<{ data: DebitCardExt[] }>('/api/v1/cards/debit').then((r) => r.data.data),
  });

  const { data: creditCards = [] } = useQuery({
    queryKey: ['creditCards'],
    queryFn: () =>
      api.get<{ data: CreditCard[] }>('/api/v1/cards/credit').then((r) => r.data.data),
  });

  // ── Spend mutation ────────────────────────────────────────────────────────
  const spendMutation = useMutation({
    mutationFn: (body: {
      source_type: string;
      source_id: string;
      amount: number;
      description?: string;
    }) => api.post('/api/v1/transactions/spend', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['debitCards'] });
      void qc.invalidateQueries({ queryKey: ['creditCards'] });
      void qc.invalidateQueries({ queryKey: ['recentTransactions'] });
      setInsufficientFunds(null);
      setAmount('');
      setDescription('');
      setMsg({ text: 'Spend recorded successfully', error: false });
    },
    onError: (err: unknown) => {
      const r = (
        err as {
          response?: {
            data?: {
              code?: string;
              available_balance?: string;
              required_amount?: string;
              top_up_sources?: TopUpSource[];
            };
          };
        }
      ).response;
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

  // Fund source account then retry spend
  const fundMutation = useMutation({
    mutationFn: (body: {
      from_type: string;
      from_id: string;
      to_type: string;
      to_id: string;
      amount: number;
    }) => api.post('/api/v1/transactions/transfer', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['debitCards'] });
      setInsufficientFunds(null);
      // Retry original spend
      const [srcType, srcId] = instrumentVal.split(':');
      const parsed = parseFloat(amount);
      spendMutation.mutate({
        source_type: srcType,
        source_id: srcId,
        amount: parsed,
        description: description || undefined,
      });
    },
    onError: (err) => setMsg({ text: `Funding failed: ${apiError(err)}`, error: true }),
  });

  // ── Instrument options ────────────────────────────────────────────────────
  type InstrumentOpt = { value: string; label: string; balance: string; group: string };

  const instrumentOptions: InstrumentOpt[] = [
    ...accounts
      .filter((a) => a.status === 'active')
      .map((a) => ({
        value: `account:${a.id}`,
        label: `${a.type.charAt(0).toUpperCase() + a.type.slice(1)} ${formatIBAN(a.iban)}`,
        balance: a.balance,
        group: 'Accounts',
      })),
    ...debitCards
      .filter((c) => c.status === 'active' && c.bankAccount.status === 'active')
      .map((c) => ({
        value: `debit_card:${c.id}`,
        label: `Debit ${maskIBAN(c.bankAccount.iban)}`,
        balance: c.bankAccount.balance,
        group: 'Debit Cards',
      })),
    ...creditCards
      .filter((c) => c.status === 'active')
      .map((c) => ({
        value: `credit_card:${c.id}`,
        label: `Credit Card`,
        balance: c.outstandingBalance,
        group: 'Credit Cards',
      })),
  ];

  const selectedType = instrumentVal.split(':')[0];
  const isCreditCard = selectedType === 'credit_card';

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setInsufficientFunds(null);
    const parsed = parseFloat(amount);
    if (!instrumentVal || !amount || isNaN(parsed) || parsed <= 0) {
      setMsg({ text: 'Please select a source and enter a valid amount', error: true });
      return;
    }
    const [srcType, srcId] = instrumentVal.split(':');
    spendMutation.mutate({
      source_type: srcType,
      source_id: srcId,
      amount: parsed,
      description: description || undefined,
    });
  }

  function handleFundAndRetry(src: TopUpSource, topUpAmt: number) {
    const [toType, toId] = instrumentVal.split(':');
    fundMutation.mutate({
      from_type: src.type,
      from_id: src.id,
      to_type: toType,
      to_id: toId,
      amount: topUpAmt,
    });
  }

  function handleSimulate() {
    setInsufficientFunds({
      available_balance: '0.00',
      required_amount: amount || '100.00',
      top_up_sources: instrumentOptions
        .filter((o) => o.value !== instrumentVal && !o.value.startsWith('credit_card:'))
        .map((o) => {
          const [type, id] = o.value.split(':');
          return {
            id,
            type: type as 'account' | 'debit_card',
            label: o.label,
            balance: o.balance,
            status: 'active' as const,
          };
        }),
    });
  }

  const selectedOpt = instrumentOptions.find((o) => o.value === instrumentVal);

  return (
    <AppShell pageTitle="Spend">
      <div data-testid="screen-spend" className="p-6">
        <h1 className="font-display text-2xl font-bold text-[#0F172A] mb-1">Spend</h1>
        <p className="text-sm font-ui text-gray-500 mb-6">
          Record a spend from any of your active accounts or cards.
        </p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Instrument selector */}
            <div>
              <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">
                Pay from
              </label>
              <select
                value={instrumentVal}
                onChange={(e) => {
                  setInstrumentVal(e.target.value);
                  setInsufficientFunds(null);
                  setMsg(null);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
                data-testid="transfer-from"
                required
              >
                <option value="">— select instrument —</option>
                {instrumentOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} — {formatCurrency(o.balance)}
                    {o.value.startsWith('credit_card:') ? ' outstanding' : ''}
                  </option>
                ))}
              </select>
              {selectedOpt && !isCreditCard && (
                <p className="text-xs font-ui text-gray-500 mt-1">
                  Available: {formatCurrency(selectedOpt.balance)}
                </p>
              )}
              {isCreditCard && (
                <p className="text-xs font-ui text-[#0096C7] mt-1">
                  Credit card — overdraft permitted, spend is always processed.
                </p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">
                Amount (€)
              </label>
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

            {/* Description */}
            <div>
              <label className="block text-sm font-ui font-semibold text-gray-700 mb-1">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Grocery shopping"
                maxLength={120}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-brand-primary"
                data-testid="transfer-note"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={spendMutation.isPending || fundMutation.isPending}
                className="bg-brand-primary text-white px-5 py-2 rounded-lg text-sm font-ui font-semibold hover:bg-[#0096C7] disabled:opacity-60 transition-colors"
                data-testid="transfer-submit"
              >
                {spendMutation.isPending || fundMutation.isPending ? 'Processing…' : 'Spend'}
              </button>
              {!isCreditCard && (
                <button
                  type="button"
                  onClick={handleSimulate}
                  className="px-4 py-2 rounded-lg text-sm font-ui font-semibold border border-gray-300 text-gray-600 hover:border-gray-400 transition-colors"
                  data-testid="transfer-simulate-insufficient"
                >
                  Simulate Insufficient
                </button>
              )}
            </div>

            {msg && (
              <p
                data-testid={msg.error ? 'msg-error' : 'msg-success'}
                className={`text-sm font-ui px-3 py-2 rounded ${
                  msg.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}
              >
                {msg.text}
              </p>
            )}
          </form>

          {insufficientFunds && !isCreditCard && (
            <InsufficientFundsPanel
              data={insufficientFunds}
              sourceType={instrumentVal.split(':')[0]}
              sourceId={instrumentVal.split(':')[1]}
              onFundAndRetry={handleFundAndRetry}
              onDismiss={() => setInsufficientFunds(null)}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
