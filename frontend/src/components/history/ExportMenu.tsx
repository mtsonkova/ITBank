import { useState } from 'react';
import api from '../../lib/axios';

const FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'xls', label: 'XLS' },
  { value: 'xlsx', label: 'XLSX' },
  { value: 'ods', label: 'ODS' },
  { value: 'pdf', label: 'PDF' },
] as const;

interface ExportMenuProps {
  endpoint: string;
  params: Record<string, string | undefined>;
  testIdPrefix: string;
}

function parseFilename(contentDisposition: string | undefined, fallback: string): string {
  const match = contentDisposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

export function ExportMenu({ endpoint, params, testIdPrefix }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleExport(format: string) {
    setDownloading(format);
    setOpen(false);
    try {
      const res = await api.get(endpoint, {
        params: { ...params, export: format },
        responseType: 'blob',
      });
      const filename = parseFilename(res.headers['content-disposition'], `transaction-history.${format}`);
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-testid={`${testIdPrefix}-export-toggle`}
        onClick={() => setOpen((v) => !v)}
        disabled={!!downloading}
        className="px-4 py-2 rounded-lg border border-border-outline text-sm font-ui font-semibold text-brand-primary hover:bg-tint-100 transition-colors disabled:opacity-50"
      >
        {downloading ? `Exporting ${downloading.toUpperCase()}…` : 'Export ▾'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-modal border border-border-light z-20 py-1">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                data-testid={`${testIdPrefix}-export-${f.value}`}
                onClick={() => handleExport(f.value)}
                className="w-full text-left px-3 py-1.5 text-sm font-ui text-[#0F172A] hover:bg-tint-100 transition-colors"
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
