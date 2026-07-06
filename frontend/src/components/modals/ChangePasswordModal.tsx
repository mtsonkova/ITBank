import { type FormEvent, useState } from 'react';
import { ChangePasswordBodySchema } from '@banking-simulator/shared-types';
import api from '../../lib/axios';
import { apiError } from '../../lib/apiError';
import { zodFieldErrors } from '../../lib/validation';

interface Props {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = ChangePasswordBodySchema.safeParse({ currentPassword, newPassword });
    if (!result.success) {
      setFieldErrors(zodFieldErrors(result.error));
      return;
    }
    setFieldErrors({});
    setStatus('loading');
    setMessage('');
    try {
      await api.put('/api/v1/auth/password', result.data);
      setStatus('success');
      setMessage('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setStatus('error');
      setMessage(apiError(err));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="modal-change-password"
    >
      <div className="bg-white rounded-xl shadow-modal w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-semibold text-base text-[#0F172A]">
            Change password
          </h2>
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
            <label className="text-xs font-medium text-[#4A5A67]">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setFieldErrors((f) => ({ ...f, currentPassword: '' })); }}
              data-testid="input-current-password"
              className="border border-border-input rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
            {fieldErrors.currentPassword && <p className="text-xs text-status-dangerText">{fieldErrors.currentPassword}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#4A5A67]">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setFieldErrors((f) => ({ ...f, newPassword: '' })); }}
              data-testid="input-new-password"
              className="border border-border-input rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
            {fieldErrors.newPassword && <p className="text-xs text-status-dangerText">{fieldErrors.newPassword}</p>}
          </div>

          {status === 'success' && (
            <p
              data-testid="msg-success"
              className="text-sm text-status-successText bg-status-successBg rounded px-3 py-2"
            >
              {message}
            </p>
          )}
          {status === 'error' && (
            <p
              data-testid="msg-error"
              className="text-sm text-status-errorText bg-status-errorBg rounded px-3 py-2"
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            data-testid="btn-change-password"
            className="mt-1 bg-brand-primary text-white rounded py-2 text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 transition-colors"
          >
            {status === 'loading' ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
