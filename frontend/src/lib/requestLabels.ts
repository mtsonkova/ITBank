export const REQ_TYPE_LABELS: Record<string, string> = {
  open_account: 'Open Account',
  close_account: 'Close Account',
  freeze_account: 'Freeze Account',
  unfreeze_account: 'Unfreeze Account',
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
  withdraw_money: 'Withdraw Money',
};

export const REQ_STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-status-warningBg text-status-warningText',
  approved: 'bg-status-successBg text-status-successText',
  rejected: 'bg-status-dangerBg text-status-dangerText',
  cancelled: 'bg-border-light text-[#5B6B7A]',
};

export function payloadSummary(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'open_account':
      return `Type: ${payload.type ?? '—'}`;
    case 'increase_credit_limit':
    case 'decrease_credit_limit':
      return `New limit: €${payload.new_limit ?? '—'}`;
    case 'withdraw_money':
      return `Amount: €${payload.amount ?? '—'}`;
    default:
      return '';
  }
}
