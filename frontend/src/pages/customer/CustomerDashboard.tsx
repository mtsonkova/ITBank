import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/axios';
import { formatCurrency, formatIBAN, formatDateTime, getGreeting } from '../../lib/formatters';
import type { BankAccount, DebitCard, CreditCard, Request, Transaction } from '@banking-simulator/shared-types';

// ─── Extended debit card type (includes bankAccount from API) ─────────────────
interface DebitCardWithAccount extends DebitCard {
  bankAccount: {
    id: string;
    iban: string;
    type: string;
    status: string;
    balance: string;
  };
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────
const fetchAccounts = () =>
  api.get<{ data: BankAccount[] }>('/api/v1/accounts').then((r) => r.data.data);

const fetchDebitCards = () =>
  api.get<{ data: DebitCardWithAccount[] }>('/api/v1/cards/debit').then((r) => r.data.data);

const fetchCreditCards = () =>
  api.get<{ data: CreditCard[] }>('/api/v1/cards/credit').then((r) => r.data.data);

const fetchRequests = () =>
  api.get<{ data: Request[] }>('/api/v1/requests').then((r) => r.data.data);

const fetchRecentTransactions = () =>
  api.get<{ data: Transaction[] }>('/api/v1/transactions/recent?limit=5').then((r) => r.data.data);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  frozen: 'Frozen',
  closed: 'Closed',
};

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-status-successBg text-status-successText',
  frozen: 'bg-status-warningBg text-status-warningText',
  closed: 'bg-status-dangerBg text-status-dangerText',
};

const TX_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  transfer: 'Transfer',
  transfer_external: 'External Transfer',
  topup: 'Card Top-Up',
  spend: 'Spend',
  withdrawal: 'Withdrawal',
};

// Outgoing transaction types (show as negative)
const TX_OUTGOING = new Set(['transfer', 'transfer_external', 'topup', 'spend', 'withdrawal']);

function txAmountClass(type: string) {
  return TX_OUTGOING.has(type) ? 'text-status-dangerText' : 'text-status-successText';
}

function txAmountSign(type: string) {
  return TX_OUTGOING.has(type) ? '-' : '+';
}

// ─── Sub-components ───────────────────────────────────────────────────────────
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
export default function CustomerDashboard() {
  const { user } = useAuth();

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts });
  const { data: debitCards = [] } = useQuery({ queryKey: ['debitCards'], queryFn: fetchDebitCards });
  const { data: creditCards = [] } = useQuery({ queryKey: ['creditCards'], queryFn: fetchCreditCards });
  const { data: requests = [] } = useQuery({ queryKey: ['requests'], queryFn: fetchRequests });
  const { data: recentTxns = [] } = useQuery({
    queryKey: ['recentTransactions'],
    queryFn: fetchRecentTransactions,
  });

  // ── Stat derivations ──
  const totalBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);
  const activeAccounts = accounts.filter((a) => a.status === 'active').length;
  const cardCount =
    debitCards.filter((c) => c.status !== 'closed').length +
    creditCards.filter((c) => c.status !== 'closed').length;
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;

  return (
    <AppShell pageTitle="Dashboard">
      <div data-testid="screen-customer-dashboard" className="space-y-6">

        {/* Greeting */}
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#0F172A]">
            {getGreeting()}, {user?.fullName}
          </h1>
          <p className="text-sm text-[#5B6B7A] mt-0.5">Here's an overview of your banking activity.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Balance"
            value={formatCurrency(totalBalance)}
            testId="stat-total-balance"
          />
          <StatCard
            label="Active Accounts"
            value={activeAccounts}
          />
          <StatCard
            label="Cards"
            value={cardCount}
          />
          <StatCard
            label="Pending Requests"
            value={pendingRequests}
            amber={pendingRequests > 0}
            testId="stat-pending-requests"
          />
        </div>

        {/* Two-column: accounts + recent transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Your accounts */}
          <div className="bg-white rounded-xl shadow-card p-5">
            <h2 className="font-display font-semibold text-[#0F172A] mb-4">Your accounts</h2>
            {accounts.length === 0 ? (
              <p className="text-sm text-[#8595A3]">No accounts yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {accounts.map((account) => (
                  <li
                    key={account.id}
                    data-testid={`account-row-${account.id}`}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-ui text-[#5B6B7A] capitalize">{account.type}</p>
                      <p className="text-xs font-ui text-[#8595A3] mt-0.5 truncate">
                        {formatIBAN(account.iban)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        data-testid={`account-status-${account.id}`}
                        className={`text-[10px] font-ui font-semibold px-2 py-0.5 rounded-full ${STATUS_CLASSES[account.status]}`}
                      >
                        {STATUS_LABELS[account.status]}
                      </span>
                      <span
                        data-testid={`account-balance-${account.id}`}
                        className="font-display font-semibold text-sm tabular-nums text-[#0F172A]"
                      >
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent transactions */}
          <div className="bg-white rounded-xl shadow-card p-5">
            <h2 className="font-display font-semibold text-[#0F172A] mb-4">Recent transactions</h2>
            {recentTxns.length === 0 ? (
              <p className="text-sm text-[#8595A3]">No transactions yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentTxns.map((tx) => (
                  <li
                    key={tx.id}
                    data-testid={`tx-row-${tx.id}`}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-ui font-medium text-[#0F172A]">
                        {TX_LABELS[tx.type] ?? tx.type}
                      </p>
                      {tx.description && (
                        <p className="text-xs font-ui text-[#8595A3] truncate mt-0.5">
                          {tx.description}
                        </p>
                      )}
                      <p className="text-xs font-ui text-[#8595A3] mt-0.5">
                        {formatDateTime(tx.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`font-display font-semibold text-sm tabular-nums shrink-0 ${txAmountClass(tx.type)}`}
                    >
                      {txAmountSign(tx.type)}{formatCurrency(tx.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl shadow-card p-5">
          <h2 className="font-display font-semibold text-[#0F172A] mb-4">Quick actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/customer/transactions"
              className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-ui font-semibold hover:bg-brand-deep transition-colors"
            >
              Transfer money
            </Link>
            <Link
              to="/customer/transactions?tab=deposit"
              className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-ui font-semibold hover:bg-brand-deep transition-colors"
            >
              Deposit
            </Link>
            <Link
              to="/customer/spend"
              className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-ui font-semibold hover:bg-brand-deep transition-colors"
            >
              Pay / Spend
            </Link>
            <Link
              to="/customer/requests"
              className="px-4 py-2 rounded-lg border border-border-outline text-brand-deep text-sm font-ui font-semibold hover:bg-tint-300 transition-colors"
            >
              New Request
            </Link>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
