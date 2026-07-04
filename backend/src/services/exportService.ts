import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import type { TransactionHistoryItem, InstrumentRef } from '@banking-simulator/shared-types';

export const EXPORT_FORMATS = ['csv', 'xlsx', 'xls', 'ods', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === 'string' && (EXPORT_FORMATS as readonly string[]).includes(value);
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  pdf: 'application/pdf',
};

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  spend: 'Spend',
  transfer: 'Transfer',
  transfer_external: 'External Transfer',
  topup: 'Top-Up',
};

const HEADERS = ['Type', 'Instrument', 'Amount', 'Counterpart', 'Date & Time'];

function formatIban(iban: string): string {
  return iban.match(/.{1,4}/g)?.join(' ') ?? iban;
}

function labelForRef(ref: InstrumentRef | null): string {
  if (!ref) return '—';
  if (ref.kind === 'account') {
    const typeLabel = ref.accountType ? ref.accountType.charAt(0).toUpperCase() + ref.accountType.slice(1) : 'Account';
    return ref.iban ? `${typeLabel} ${formatIban(ref.iban)}` : typeLabel;
  }
  return ref.kind === 'debit_card' ? 'Debit Card' : 'Credit Card';
}

function formatAmount(amount: string): string {
  const value = parseFloat(amount);
  const sign = value < 0 ? '-' : '';
  return `${sign}€${Math.abs(value).toFixed(2)}`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function toRow(item: TransactionHistoryItem): string[] {
  return [
    TYPE_LABELS[item.type] ?? item.type,
    labelForRef(item.instrument),
    formatAmount(item.amount),
    item.counterpart ? labelForRef(item.counterpart) : (item.description ?? '—'),
    formatDateTime(item.createdAt),
  ];
}

function buildSpreadsheet(items: TransactionHistoryItem[], format: Exclude<ExportFormat, 'pdf'>): Buffer {
  const aoa = [HEADERS, ...items.map(toRow)];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'History');

  const bookType = format === 'xls' ? 'biff8' : format;
  return XLSX.write(workbook, { type: 'buffer', bookType }) as Buffer;
}

function buildPdf(items: TransactionHistoryItem[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const colX = [40, 160, 320, 430, 590];
    const pageBottom = doc.page.height - 40;

    function drawHeader() {
      doc.font('Helvetica-Bold').fontSize(10);
      HEADERS.forEach((h, i) => doc.text(h, colX[i], doc.y, { continued: false, width: colX[i + 1] ? colX[i + 1] - colX[i] : 150 }));
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(9);
    }

    doc.font('Helvetica-Bold').fontSize(16).text('Transaction History', { align: 'left' });
    doc.moveDown();
    drawHeader();

    for (const item of items) {
      if (doc.y > pageBottom) {
        doc.addPage();
        doc.y = 40;
        drawHeader();
      }
      const row = toRow(item);
      const y = doc.y;
      row.forEach((cell, i) => {
        doc.text(cell, colX[i], y, { width: colX[i + 1] ? colX[i + 1] - colX[i] - 8 : 150 });
      });
      doc.moveDown(0.7);
    }

    doc.end();
  });
}

export async function generateExport(
  items: TransactionHistoryItem[],
  format: ExportFormat,
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const buffer = format === 'pdf' ? await buildPdf(items) : buildSpreadsheet(items, format);
  return { buffer, contentType: CONTENT_TYPES[format], extension: format };
}
