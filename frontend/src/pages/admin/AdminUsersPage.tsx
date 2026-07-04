import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AppShell } from '../../components/layout/AppShell';
import api from '../../lib/axios';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminManager {
  id: string;
  username: string;
  fullName: string;
  clientCount: number;
  createdAt: string;
}

interface AdminCustomer {
  id: string;
  username: string;
  fullName: string;
  createdAt: string;
  managerId: string | null;
  managerName: string | null;
}

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

// ─── Fetchers ─────────────────────────────────────────────────────────────────
const fetchManagers = () =>
  api.get<{ data: AdminManager[] }>('/api/v1/admin/managers').then((r) => r.data.data);

const fetchCustomers = () =>
  api.get<{ data: AdminCustomer[] }>('/api/v1/admin/customers').then((r) => r.data.data);

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const qc = useQueryClient();

  const { data: managers = [], isLoading: managersLoading } = useQuery({
    queryKey: ['adminManagers'],
    queryFn: fetchManagers,
  });
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['adminCustomers'],
    queryFn: fetchCustomers,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['adminManagers'] });
    qc.invalidateQueries({ queryKey: ['adminCustomers'] });
  };

  const [addManagerOpen, setAddManagerOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [reassignAllFor, setReassignAllFor] = useState<AdminManager | null>(null);
  const [reassignCustomerFor, setReassignCustomerFor] = useState<AdminCustomer | null>(null);
  const [resetPasswordFor, setResetPasswordFor] = useState<AdminCustomer | null>(null);
  const [removeManagerFor, setRemoveManagerFor] = useState<AdminManager | null>(null);

  return (
    <AppShell pageTitle="User Management">
      <div data-testid="screen-users" className="space-y-6">
        <h1 className="font-display text-xl font-semibold text-[#0F172A]">User Management</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Account Managers panel ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-display font-semibold text-[#0F172A]">Account Managers</h2>
              <button
                type="button"
                data-testid="btn-add-manager"
                onClick={() => setAddManagerOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-ui font-semibold hover:bg-brand-deep transition-colors"
              >
                + Add Manager
              </button>
            </div>

            {managersLoading ? (
              <p className="text-sm font-ui text-gray-500 p-6">Loading…</p>
            ) : managers.length === 0 ? (
              <p className="text-sm font-ui text-gray-500 p-6">No account managers yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {managers.map((m) => (
                  <li
                    key={m.id}
                    data-testid={`manager-row-${m.id}`}
                    className="px-5 py-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-avatar-bg text-avatar-text text-xs font-semibold flex items-center justify-center shrink-0">
                        {getInitials(m.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">{m.fullName}</p>
                        <p className="text-xs text-[#8595A3] mt-0.5">
                          {m.clientCount} assigned {m.clientCount === 1 ? 'client' : 'clients'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid={`btn-reassign-all-${m.id}`}
                        onClick={() => setReassignAllFor(m)}
                        className="text-xs font-semibold text-brand-primary hover:text-brand-deep border border-border-outline hover:border-brand-primary px-3 py-1 rounded-lg transition-colors"
                      >
                        Reassign All
                      </button>
                      <button
                        type="button"
                        data-testid={`btn-remove-manager-${m.id}`}
                        disabled={m.clientCount > 0}
                        onClick={() => setRemoveManagerFor(m)}
                        className="text-xs font-semibold text-status-dangerText border border-status-dangerText/40 hover:bg-status-dangerBg px-3 py-1 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Customers panel ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-display font-semibold text-[#0F172A]">Customers</h2>
              <button
                type="button"
                data-testid="btn-add-customer"
                onClick={() => setAddCustomerOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-ui font-semibold hover:bg-brand-deep transition-colors"
              >
                + Add Customer
              </button>
            </div>

            {customersLoading ? (
              <p className="text-sm font-ui text-gray-500 p-6">Loading…</p>
            ) : customers.length === 0 ? (
              <p className="text-sm font-ui text-gray-500 p-6">No customers yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {customers.map((c) => (
                  <li
                    key={c.id}
                    data-testid={`customer-row-${c.id}`}
                    className="px-5 py-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-avatar-bg text-avatar-text text-xs font-semibold flex items-center justify-center shrink-0">
                        {getInitials(c.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">{c.fullName}</p>
                        <p className="text-xs text-[#8595A3] mt-0.5">
                          Manager: {c.managerName ?? '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid={`btn-reassign-customer-${c.id}`}
                        onClick={() => setReassignCustomerFor(c)}
                        className="text-xs font-semibold text-brand-primary hover:text-brand-deep border border-border-outline hover:border-brand-primary px-3 py-1 rounded-lg transition-colors"
                      >
                        Reassign
                      </button>
                      <button
                        type="button"
                        data-testid={`btn-reset-password-${c.id}`}
                        onClick={() => setResetPasswordFor(c)}
                        className="text-xs font-semibold text-brand-primary hover:text-brand-deep border border-border-outline hover:border-brand-primary px-3 py-1 rounded-lg transition-colors"
                      >
                        Reset Password
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {addManagerOpen && (
        <AddManagerModal onClose={() => setAddManagerOpen(false)} onCreated={invalidateAll} />
      )}
      {addCustomerOpen && (
        <AddCustomerModal
          managers={managers}
          onClose={() => setAddCustomerOpen(false)}
          onCreated={invalidateAll}
        />
      )}
      {reassignAllFor && (
        <ReassignAllModal
          manager={reassignAllFor}
          managers={managers}
          onClose={() => setReassignAllFor(null)}
          onReassigned={invalidateAll}
        />
      )}
      {reassignCustomerFor && (
        <ReassignCustomerModal
          customer={reassignCustomerFor}
          managers={managers}
          onClose={() => setReassignCustomerFor(null)}
          onReassigned={invalidateAll}
        />
      )}
      {resetPasswordFor && (
        <ResetPasswordModal customer={resetPasswordFor} onClose={() => setResetPasswordFor(null)} />
      )}
      {removeManagerFor && (
        <RemoveManagerModal
          manager={removeManagerFor}
          onClose={() => setRemoveManagerFor(null)}
          onRemoved={invalidateAll}
        />
      )}
    </AppShell>
  );
}

// ─── Shared modal shell ─────────────────────────────────────────────────────
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-modal w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-semibold text-base text-[#0F172A]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4A5A67] hover:text-[#0F172A] text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusMessages({ status, message }: { status: 'idle' | 'loading' | 'success' | 'error'; message: string }) {
  if (status === 'success') {
    return (
      <p data-testid="msg-success" className="text-sm text-status-successText bg-status-successBg rounded px-3 py-2">
        {message}
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="msg-error" className="text-sm text-status-errorText bg-status-errorBg rounded px-3 py-2">
        {message}
      </p>
    );
  }
  return null;
}

// ─── Add Manager Modal ──────────────────────────────────────────────────────
function AddManagerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const createManager = useMutation({
    mutationFn: () =>
      api.post('/api/v1/admin/managers', { fullName, username, password }).then((r) => r.data),
    onSuccess: () => {
      setStatus('success');
      setMessage('Account manager created successfully.');
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
    createManager.mutate();
  }

  return (
    <ModalShell title="Add Manager" onClose={onClose}>
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

        <StatusMessages status={status} message={message} />

        <button
          type="submit"
          disabled={status === 'loading'}
          data-testid="btn-submit-manager"
          className="mt-1 bg-brand-primary text-white rounded py-2 text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 transition-colors"
        >
          {status === 'loading' ? 'Creating…' : 'Add Manager'}
        </button>
      </form>
    </ModalShell>
  );
}

// ─── Remove Manager Modal ───────────────────────────────────────────────────
function RemoveManagerModal({
  manager,
  onClose,
  onRemoved,
}: {
  manager: AdminManager;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const removeManager = useMutation({
    mutationFn: () => api.delete(`/api/v1/admin/managers/${manager.id}`).then((r) => r.data),
    onSuccess: () => {
      setStatus('success');
      setMessage('Account manager removed successfully.');
      onRemoved();
      setTimeout(onClose, 1200);
    },
    onError: (err) => {
      setStatus('error');
      setMessage(apiError(err));
    },
  });

  return (
    <ModalShell title={`Remove ${manager.fullName}?`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#5B6B7A]">This account manager will no longer be able to log in.</p>

        <StatusMessages status={status} message={message} />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded text-sm font-semibold text-[#5B6B7A] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="btn-confirm-remove-manager"
            disabled={status === 'loading'}
            onClick={() => {
              setStatus('loading');
              setMessage('');
              removeManager.mutate();
            }}
            className="px-3 py-2 rounded text-sm font-semibold bg-status-dangerText text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {status === 'loading' ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Add Customer Modal ─────────────────────────────────────────────────────
function AddCustomerModal({
  managers,
  onClose,
  onCreated,
}: {
  managers: AdminManager[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [managerId, setManagerId] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const createCustomer = useMutation({
    mutationFn: () =>
      api.post('/api/v1/admin/customers', { fullName, username, password, managerId }).then((r) => r.data),
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
    createCustomer.mutate();
  }

  return (
    <ModalShell title="Add Customer" onClose={onClose}>
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
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#4A5A67]">Assign to manager</label>
          <select
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            required
            data-testid="select-manager"
            className="border border-border-input rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
          >
            <option value="">— select manager —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
        </div>

        <StatusMessages status={status} message={message} />

        <button
          type="submit"
          disabled={status === 'loading'}
          data-testid="btn-submit-customer"
          className="mt-1 bg-brand-primary text-white rounded py-2 text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 transition-colors"
        >
          {status === 'loading' ? 'Creating…' : 'Add Customer'}
        </button>
      </form>
    </ModalShell>
  );
}

// ─── Reassign All Modal (manager → manager, bulk) ──────────────────────────
function ReassignAllModal({
  manager,
  managers,
  onClose,
  onReassigned,
}: {
  manager: AdminManager;
  managers: AdminManager[];
  onClose: () => void;
  onReassigned: () => void;
}) {
  const [toManagerId, setToManagerId] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const targets = managers.filter((m) => m.id !== manager.id);

  const reassignAll = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/admin/managers/${manager.id}/reassign`, { toManagerId }).then((r) => r.data),
    onSuccess: () => {
      setStatus('success');
      setMessage('Clients reassigned successfully.');
      onReassigned();
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
    reassignAll.mutate();
  }

  return (
    <ModalShell title={`Reassign all clients from ${manager.fullName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-[#5B6B7A]">
          Moves all {manager.clientCount} assigned {manager.clientCount === 1 ? 'client' : 'clients'} to
          a different manager.
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#4A5A67]">Target manager</label>
          <select
            value={toManagerId}
            onChange={(e) => setToManagerId(e.target.value)}
            required
            data-testid="select-manager"
            className="border border-border-input rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
          >
            <option value="">— select manager —</option>
            {targets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
        </div>

        <StatusMessages status={status} message={message} />

        <button
          type="submit"
          disabled={status === 'loading' || !toManagerId}
          data-testid="btn-confirm-reassign-all"
          className="mt-1 bg-brand-primary text-white rounded py-2 text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 transition-colors"
        >
          {status === 'loading' ? 'Reassigning…' : 'Confirm Reassignment'}
        </button>
      </form>
    </ModalShell>
  );
}

// ─── Reassign Customer Modal (single customer → manager) ───────────────────
function ReassignCustomerModal({
  customer,
  managers,
  onClose,
  onReassigned,
}: {
  customer: AdminCustomer;
  managers: AdminManager[];
  onClose: () => void;
  onReassigned: () => void;
}) {
  const [toManagerId, setToManagerId] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const targets = managers.filter((m) => m.id !== customer.managerId);

  const reassign = useMutation({
    mutationFn: () =>
      api.patch(`/api/v1/admin/customers/${customer.id}/reassign`, { toManagerId }).then((r) => r.data),
    onSuccess: () => {
      setStatus('success');
      setMessage('Customer reassigned successfully.');
      onReassigned();
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
    reassign.mutate();
  }

  return (
    <ModalShell title={`Reassign ${customer.fullName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#4A5A67]">New manager</label>
          <select
            value={toManagerId}
            onChange={(e) => setToManagerId(e.target.value)}
            required
            data-testid="select-manager"
            className="border border-border-input rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
          >
            <option value="">— select manager —</option>
            {targets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
        </div>

        <StatusMessages status={status} message={message} />

        <button
          type="submit"
          disabled={status === 'loading' || !toManagerId}
          data-testid="btn-confirm-reassign-customer"
          className="mt-1 bg-brand-primary text-white rounded py-2 text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 transition-colors"
        >
          {status === 'loading' ? 'Reassigning…' : 'Confirm Reassignment'}
        </button>
      </form>
    </ModalShell>
  );
}

// ─── Reset Password Modal (new password only, no current password) ─────────
function ResetPasswordModal({
  customer,
  onClose,
}: {
  customer: AdminCustomer;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const resetPassword = useMutation({
    mutationFn: () =>
      api.put(`/api/v1/admin/users/${customer.id}/password`, { newPassword }).then((r) => r.data),
    onSuccess: () => {
      setStatus('success');
      setMessage('Password reset successfully.');
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
    resetPassword.mutate();
  }

  return (
    <ModalShell title={`Reset password — ${customer.fullName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#4A5A67]">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            data-testid="input-new-password"
            className="border border-border-input rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
          />
        </div>

        <StatusMessages status={status} message={message} />

        <button
          type="submit"
          disabled={status === 'loading'}
          data-testid="btn-confirm-reset-password"
          className="mt-1 bg-brand-primary text-white rounded py-2 text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 transition-colors"
        >
          {status === 'loading' ? 'Saving…' : 'Reset Password'}
        </button>
      </form>
    </ModalShell>
  );
}
