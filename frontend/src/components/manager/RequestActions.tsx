import { useState } from 'react';

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

  function confirmReject() {
    if (!reason.trim()) return;
    onReject(reason.trim());
    setReason('');
    setShowReject(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          data-testid={`request-approve-${requestId}`}
          onClick={onApprove}
          disabled={approving || rejecting}
          className="px-3 py-1.5 rounded-lg bg-status-successText text-white text-xs font-ui font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Approve
        </button>
        <button
          type="button"
          data-testid={`request-reject-${requestId}`}
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
            data-testid={`input-rejection-reason-${requestId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full border border-status-warningText/40 rounded px-2 py-1 text-xs font-ui text-[#0F172A] outline-none focus:border-status-warningText"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowReject(false);
                setReason('');
              }}
              className="px-2.5 py-1 rounded text-xs font-ui font-semibold text-[#5B6B7A] hover:bg-white/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid={`btn-confirm-reject-${requestId}`}
              onClick={confirmReject}
              disabled={!reason.trim() || rejecting}
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
