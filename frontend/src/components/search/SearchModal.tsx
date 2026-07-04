import { useEffect, useState } from 'react';
import type { Role, SearchResults } from '@banking-simulator/shared-types';
import { useAuth } from '../../contexts/AuthContext';
import { ExportMenu } from '../history/ExportMenu';
import { SearchResultSection } from './SearchResultSection';

type GroupKey = keyof SearchResults;

const ROLE_GROUPS: Record<Role, { key: GroupKey; label: string }[]> = {
  customer: [
    { key: 'accounts', label: 'Accounts' },
    { key: 'cards', label: 'Cards' },
    { key: 'transactions', label: 'Transactions' },
  ],
  account_manager: [
    { key: 'accounts', label: 'Accounts' },
    { key: 'cards', label: 'Cards' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'users', label: 'Clients' },
  ],
  admin: [
    { key: 'accounts', label: 'Accounts' },
    { key: 'cards', label: 'Cards' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'users', label: 'Customers' },
    { key: 'managers', label: 'Managers' },
  ],
};

interface SearchModalProps {
  query: string;
  onClose: () => void;
}

export function SearchModal({ query, onClose }: SearchModalProps) {
  const { user } = useAuth();
  const [pages, setPages] = useState<Partial<Record<GroupKey, number>>>({});

  useEffect(() => {
    setPages({});
  }, [query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!user) return null;
  const groups = ROLE_GROUPS[user.role];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="search-modal-backdrop"
    >
      <div
        className="bg-white rounded-2xl shadow-modal w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col"
        data-testid="search-modal"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light shrink-0">
          <h2 className="font-display font-semibold text-base text-[#0F172A]">
            Search results for &quot;{query}&quot;
          </h2>
          <div className="flex items-center gap-3">
            <ExportMenu endpoint="/api/v1/search" params={{ q: query }} testIdPrefix="search" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              data-testid="search-modal-close"
              className="text-[#4A5A67] hover:text-[#0F172A] text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-border-light">
          {groups.map(({ key, label }) => (
            <SearchResultSection
              key={key}
              group={key}
              label={label}
              query={query}
              page={pages[key] ?? 1}
              onPageChange={(page) => setPages((p) => ({ ...p, [key]: page }))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
