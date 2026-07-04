import { useQuery } from '@tanstack/react-query';
import type { SearchResults } from '@banking-simulator/shared-types';
import api from '../../lib/axios';
import { HistoryTable } from '../history/HistoryTable';
import { SimpleTable } from './SimpleTable';
import { accountRow, cardRow, managerRow, userRow } from './searchRowBuilders';

type GroupKey = keyof SearchResults;

const LIMIT = 10;

interface SearchResultSectionProps {
  group: GroupKey;
  label: string;
  query: string;
  page: number;
  onPageChange: (page: number) => void;
}

export function SearchResultSection({ group, label, query, page, onPageChange }: SearchResultSectionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['search', group, query, page],
    queryFn: () =>
      api
        .get<SearchResults>('/api/v1/search', { params: { q: query, page, limit: LIMIT } })
        .then((r) => r.data[group]),
    enabled: query.length >= 2,
  });

  if (!isLoading && (!data || data.total === 0)) return null;

  return (
    <section className="p-6" data-testid={`search-section-${group}`}>
      <h3 className="text-xs font-ui font-semibold uppercase tracking-wide text-[#5B6B7A] mb-3">
        {label} {data ? `(${data.total})` : ''}
      </h3>

      {isLoading || !data ? (
        <p className="text-sm font-ui text-gray-500">Loading…</p>
      ) : (
        renderTable(group, data.data)
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 mt-3 text-sm font-ui">
          <button
            type="button"
            data-testid={`search-${group}-prev`}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-border-outline text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-tint-100 transition-colors"
          >
            Previous
          </button>
          <span data-testid={`search-${group}-page-indicator`} className="text-[#5B6B7A]">
            Page {data.page} of {data.totalPages}
          </span>
          <button
            type="button"
            data-testid={`search-${group}-next`}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= data.totalPages}
            className="px-3 py-1.5 rounded-lg border border-border-outline text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-tint-100 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

function renderTable(group: GroupKey, items: SearchResults[GroupKey]['data']): React.ReactNode {
  const testIdPrefix = `search-${group}`;

  switch (group) {
    case 'transactions':
      return <HistoryTable items={items as SearchResults['transactions']['data']} isLoading={false} testIdPrefix={testIdPrefix} />;
    case 'accounts':
      return (
        <SimpleTable
          headers={['IBAN', 'Type', 'Status', 'Balance', 'Created']}
          rows={(items as SearchResults['accounts']['data']).map(accountRow)}
          testIdPrefix={testIdPrefix}
        />
      );
    case 'cards':
      return (
        <SimpleTable
          headers={['Card Type', 'IBAN', 'Status', 'Credit Limit', 'Outstanding Balance', 'Created']}
          rows={(items as SearchResults['cards']['data']).map(cardRow)}
          testIdPrefix={testIdPrefix}
        />
      );
    case 'users':
      return (
        <SimpleTable
          headers={['Full Name', 'Username', 'Role', 'Created']}
          rows={(items as SearchResults['users']['data']).map(userRow)}
          testIdPrefix={testIdPrefix}
        />
      );
    case 'managers':
      return (
        <SimpleTable
          headers={['Full Name', 'Username', 'Clients', 'Created']}
          rows={(items as SearchResults['managers']['data']).map(managerRow)}
          testIdPrefix={testIdPrefix}
        />
      );
  }
}
