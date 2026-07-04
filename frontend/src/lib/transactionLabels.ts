import type { InstrumentRef, TransactionType } from '@banking-simulator/shared-types';
import { formatIBAN } from './formatters';

export const TX_TYPE_LABELS: Record<TransactionType, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  spend: 'Spend',
  transfer: 'Transfer',
  transfer_external: 'External Transfer',
  topup: 'Top-Up',
};

export function instrumentLabel(ref: InstrumentRef | null): string {
  if (!ref) return '—';
  if (ref.kind === 'account') {
    const typeLabel = ref.accountType ? ref.accountType.charAt(0).toUpperCase() + ref.accountType.slice(1) : 'Account';
    return ref.iban ? `${typeLabel} ${formatIBAN(ref.iban)}` : typeLabel;
  }
  return ref.kind === 'debit_card' ? 'Debit Card' : 'Credit Card';
}
