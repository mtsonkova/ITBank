import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AppShell } from '../../components/layout/AppShell';
import api from '../../lib/axios';
import { formatCurrency } from '../../lib/formatters';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ManagerClient {
  id: string;
  username: string;
  fullName: string;
  accountsCount: number;
  cardsCount: number;
  totalBalance: string;
  pendingRequestsCount: number;
  status: string;
}

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-status-successBg text-status-successText',
  inactive: 'bg-border-light text-[#5B6B7A]',
  new: 'bg-status-warningBg text-status-warningText',
};

function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error ?? 'Something went wrong';
  return 'Something went wrong';
}

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase();
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────
const fetchClients = () =>
  api.get<{ data: ManagerClient[] }>('/api/v1/manager/clients').then((r) => r.data.data);

// ─── Main component ───────────────────────────────────────────────────────────
export default function ClientsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['managerClients'],
    queryFn: fetchClients,
  });

  return (
    <AppShell pageTitle="My Clients">
      <div data-testid="screen-clients" className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold text-[#0F172A]">My Clients</h1>
          <button
            type="button"
            data-testid="btn-add-client"
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-ui font-semibold hover:bg-brand-deep transition-colors"
          >
            + Add Customer
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <p className="text-sm font-ui text-gray-500 p-6">Loading…</p>
          ) : clients.length === 0 ? (
            <p className="text-sm font-ui text-gray-500 p-6">No clients assigned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-ui">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Client</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Accounts</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Total Balance</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clients.map((client) => (
                    <tr
                      key={client.id}
                      data-testid={`client-row-${client.id}`}
                      onClick={() => navigate(`/manager/clients/${client.id}`)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-avatar-bg text-avatar-text text-xs font-semibold flex items-center justify-center shrink-0">
                            {getInitials(client.fullName)}
                          </div>
                          <span className="font-semibold text-[#0F172A]">{client.fullName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#5B6B7A]">{client.accountsCount}</td>
                      <td className="px-5 py-4 font-display font-semibold tabular-nums text-[#0F172A]">
                        {formatCurrency(client.totalBalance)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          data-testid={`client-status-${client.id}`}
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_CLASSES[client.status] ?? ''}`}
                        >
                          {client.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          to={`/manager/clients/${client.id}`}
                          data-testid={`client-view-${client.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-semibold text-brand-primary hover:text-brand-deep border border-border-outline hover:border-brand-primary px-3 py-1 rounded-lg transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <AddClientModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['managerClients'] });
          }}
        />
      )}
    </AppShell>
  );
}

// ─── Add Customer Modal ────────────────────────────────────────────────────────
function AddClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const createClient = useMutation({
    mutationFn: () =>
      api.post('/api/v1/manager/clients', { fullName, username, password }).then((r) => r.data),
    onSuccess: () => {
      setStatus('success');
      setMessage('Customer created successfully.');
      onCreated();
      setTimeout(onClose, 1200);
    },
    onError: (err) => {
      setStatus('error');
      setMessage(apiError(err));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    createClient.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-modal w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-semibold text-base text-[#0F172A]">Add Customer</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4A5A67] hover:text-[#0F172A] text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#4A5A67]">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              data-testid="input-full-name"
              className="border border-border-input rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#4A5A67]">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              data-testid="input-username"
              className="border border-border-input rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#4A5A67]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="input-password"
              className="border border-border-input rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
          </div>

          {status === 'success' && (
            <p data-testid="msg-success" className="text-sm text-status-successText bg-status-successBg rounded px-3 py-2">
              {message}
            </p>
          )}
          {status === 'error' && (
            <p data-testid="msg-error" className="text-sm text-status-errorText bg-status-errorBg rounded px-3 py-2">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            data-testid="btn-submit-client"
            className="mt-1 bg-brand-primary text-white rounded py-2 text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 transition-colors"
          >
            {status === 'loading' ? 'Creating…' : 'Add Customer'}
          </button>
        </form>
      </div>
    </div>
  );
}
