export const PAGE_SIZES = [10, 25, 50, 100] as const;

interface PaginationProps {
  page: number;
  totalPages: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  testIdPrefix: string;
}

export function Pagination({ page, totalPages, limit, onPageChange, onLimitChange, testIdPrefix }: PaginationProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border-light text-sm font-ui">
      <div className="flex items-center gap-2 text-[#5B6B7A]">
        <span>Rows per page</span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          data-testid={`${testIdPrefix}-page-size`}
          className="border border-border-input rounded px-2 py-1 text-sm font-ui text-[#0F172A] focus:outline-none focus:border-brand-primary"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid={`${testIdPrefix}-prev-page`}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-border-outline text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-tint-100 transition-colors"
        >
          Previous
        </button>
        <span data-testid={`${testIdPrefix}-page-indicator`} className="text-[#5B6B7A]">
          Page {totalPages === 0 ? 0 : page} of {totalPages}
        </span>
        <button
          type="button"
          data-testid={`${testIdPrefix}-next-page`}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-border-outline text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-tint-100 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
