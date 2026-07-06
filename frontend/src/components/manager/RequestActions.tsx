import { useState } from 'react';
import { RejectRequestBodySchema } from '@banking-simulator/shared-types';

interface Props {
  requestId: string;
  onApprove: () => void;
  onReject: (reason: string) => void;
  approving?: boolean;
  rejecting?: boolean;
}

export function RequestActions({ requestId, onApprove, onReject, approving, rejecting }: Props) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const validation = RejectRequestBodySchema.safeParse({ reason });
  const fieldError = touched && !validation.success ? validation.error.issues[0]?.message : undefined;

  function confirmReject() {
    setTouched(true);
    if (!validation.success) return;
    onReject(validation.data.reason);
    setReason('');
    setTouched(false);
    setShowReject(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          data-testid={`approve-${requestId}`}
          onClick={onApprove}
          disabled={approving || rejecting}
          className="px-3 py-1.5 rounded-lg bg-status-successText text-white text-xs font-ui font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Approve
        </button>
        <button
          type="button"
          data-testid={`reject-${requestId}`}
          onClick={() => setShowReject((v) => !v)}
          disabled={approving || rejecting}
          className="px-3 py-1.5 rounded-lg border border-status-dangerText text-status-dangerText text-xs font-ui font-semibold hover:bg-status-dangerBg transition-colors disabled:opacity-40"
        >
          Reject
        </button>
      </div>

      {showReject && (
        <div className="bg-status-warningBg border border-status-warningText/30 rounded-lg p-3 space-y-2 w-64">
          <label className="text-xs font-ui font-semibold text-status-warningText">
            Reason for rejection (required)
          </label>
          <textarea
            data-testid="rejection-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={2}
            className="w-full border border-status-warningText/40 rounded px-2 py-1 text-xs font-ui text-[#0F172A] outline-none focus:border-status-warningText"
          />
          {fieldError && <p className="text-xs text-status-dangerText">{fieldError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              data-testid="cancel-reject"
              onClick={() => {
                setShowReject(false);
                setReason('');
                setTouched(false);
              }}
              className="px-2.5 py-1 rounded text-xs font-ui font-semibold text-[#5B6B7A] hover:bg-white/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="confirm-reject"
              onClick={confirmReject}
              disabled={rejecting}
              className="px-2.5 py-1 rounded text-xs font-ui font-semibold bg-status-dangerText text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
