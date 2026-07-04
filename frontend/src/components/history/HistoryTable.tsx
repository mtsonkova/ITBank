import type { TransactionHistoryItem } from '@banking-simulator/shared-types';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { TX_TYPE_LABELS, instrumentLabel } from '../../lib/transactionLabels';

interface HistoryTableProps {
  items: TransactionHistoryItem[];
  isLoading: boolean;
  testIdPrefix: string;
}

export function HistoryTable({ items, isLoading, testIdPrefix }: HistoryTableProps) {
  if (isLoading) {
    return <p className="text-sm font-ui text-gray-500 p-6">Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <p data-testid={`${testIdPrefix}-empty`} className="text-sm font-ui text-gray-500 p-6">
        No transactions found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-ui">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left">
            <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Type</th>
            <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Instrument</th>
            <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Amount</th>
            <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Counterpart</th>
            <th className="px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Date &amp; Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((item) => {
            const signed = parseFloat(item.amount) >= 0;
            return (
              <tr key={item.id} data-testid={`${testIdPrefix}-row-${item.id}`} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4 text-[#0F172A]">{TX_TYPE_LABELS[item.type] ?? item.type}</td>
                <td className="px-5 py-4 text-[#5B6B7A]">{instrumentLabel(item.instrument)}</td>
                <td
                  className={`px-5 py-4 font-display font-semibold tabular-nums ${
                    signed ? 'text-status-successText' : 'text-status-dangerText'
                  }`}
                >
                  {formatCurrency(item.amount)}
                </td>
                <td className="px-5 py-4 text-[#5B6B7A]">
                  {item.counterpart ? instrumentLabel(item.counterpart) : (item.description ?? '—')}
                </td>
                <td className="px-5 py-4 text-[#5B6B7A]">{formatDateTime(item.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
