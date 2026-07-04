import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '../../lib/axios';

interface Props {
  onClose: () => void;
}

type Step = 'confirm' | 'cancelled' | 'success' | 'error';

function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error ?? 'Something went wrong';
  return 'Something went wrong';
}

export function ResetDatabaseModal({ onClose }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('confirm');
  const [message, setMessage] = useState('');

  const resetDatabase = useMutation({
    mutationFn: () => api.post('/api/v1/test/reset').then((r) => r.data),
    onSuccess: () => {
      // Every cached list (managers, customers, requests, accounts, ...) points
      // at rows the reset just replaced — nothing survives a reseed, so refetch it all.
      qc.invalidateQueries();
      setStep('success');
    },
    onError: (err) => {
      setMessage(apiError(err));
      setStep('error');
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="modal-reset-database"
    >
      <div className="bg-white rounded-xl shadow-modal w-full max-w-sm mx-4 p-6">
        {step === 'confirm' && (
          <>
            <h2 className="font-display font-semibold text-base text-[#0F172A] mb-3">Reset Database</h2>
            <p className="text-sm text-[#5B6B7A] mb-5">
              This will wipe all current data and reseed the database with the default demo dataset.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="btn-reset-database-cancel"
                onClick={() => setStep('cancelled')}
                className="px-4 py-2 rounded text-sm font-semibold text-[#5B6B7A] hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="btn-reset-database-ok"
                disabled={resetDatabase.isPending}
                onClick={() => resetDatabase.mutate()}
                className="px-4 py-2 rounded text-sm font-semibold bg-status-dangerText text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {resetDatabase.isPending ? 'Resetting…' : 'OK'}
              </button>
            </div>
          </>
        )}

        {step === 'cancelled' && (
          <>
            <p data-testid="msg-reset-cancelled" className="text-sm text-[#0F172A] mb-5">
              Database reset operation terminated.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="btn-reset-database-close"
                onClick={onClose}
                className="px-4 py-2 rounded text-sm font-semibold bg-brand-primary text-white hover:bg-brand-deep transition-colors"
              >
                OK
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <p data-testid="msg-reset-success" className="text-sm text-status-successText mb-5">
              Database reset successfully.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="btn-reset-database-close"
                onClick={onClose}
                className="px-4 py-2 rounded text-sm font-semibold bg-brand-primary text-white hover:bg-brand-deep transition-colors"
              >
                OK
              </button>
            </div>
          </>
        )}

        {step === 'error' && (
          <>
            <p data-testid="msg-reset-error" className="text-sm text-status-errorText mb-5">
              {message}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="btn-reset-database-close"
                onClick={onClose}
                className="px-4 py-2 rounded text-sm font-semibold bg-brand-primary text-white hover:bg-brand-deep transition-colors"
              >
                OK
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
