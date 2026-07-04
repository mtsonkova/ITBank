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

// ─── Sectioned export (search results: multiple entity-type groups in one file) ─
import type { SearchExportData } from './searchService';
import type { BankAccount, SearchCardItem, SearchManagerItem, User } from '@banking-simulator/shared-types';

interface ExportSection {
  label: string;
  headers: string[];
  rows: string[][];
}

const ROLE_LABELS: Record<string, string> = {
  customer: 'Customer',
  account_manager: 'Account Manager',
  admin: 'Admin',
};

function accountRow(a: BankAccount): string[] {
  return [formatIban(a.iban), a.type.charAt(0).toUpperCase() + a.type.slice(1), a.status, formatAmount(a.balance), formatDateTime(a.createdAt)];
}

function cardRow(c: SearchCardItem): string[] {
  return [
    c.cardType === 'debit' ? 'Debit' : 'Credit',
    c.iban ? formatIban(c.iban) : '—',
    c.status,
    c.creditLimit ? formatAmount(c.creditLimit) : '—',
    c.outstandingBalance ? formatAmount(c.outstandingBalance) : '—',
    formatDateTime(c.createdAt),
  ];
}

function userRow(u: User): string[] {
  return [u.fullName, u.username, ROLE_LABELS[u.role] ?? u.role, formatDateTime(u.createdAt)];
}

function managerRow(m: SearchManagerItem): string[] {
  return [m.fullName, m.username, String(m.clientCount), formatDateTime(m.createdAt)];
}

function buildSearchSections(data: SearchExportData): ExportSection[] {
  const sections: ExportSection[] = [];

  if (data.accounts.length) {
    sections.push({ label: 'Accounts', headers: ['IBAN', 'Type', 'Status', 'Balance', 'Created'], rows: data.accounts.map(accountRow) });
  }
  if (data.cards.length) {
    sections.push({
      label: 'Cards',
      headers: ['Card Type', 'IBAN', 'Status', 'Credit Limit', 'Outstanding Balance', 'Created'],
      rows: data.cards.map(cardRow),
    });
  }
  if (data.transactions.length) {
    sections.push({ label: 'Transactions', headers: HEADERS, rows: data.transactions.map(toRow) });
  }
  if (data.users.length) {
    sections.push({ label: 'Users', headers: ['Full Name', 'Username', 'Role', 'Created'], rows: data.users.map(userRow) });
  }
  if (data.managers.length) {
    sections.push({ label: 'Managers', headers: ['Full Name', 'Username', 'Clients', 'Created'], rows: data.managers.map(managerRow) });
  }

  return sections;
}

function sheetNameFor(label: string, used: Set<string>): string {
  let name = label.slice(0, 31);
  let i = 2;
  while (used.has(name)) {
    name = `${label.slice(0, 28)}_${i++}`;
  }
  used.add(name);
  return name;
}

function buildSectionedSpreadsheet(sections: ExportSection[], format: Exclude<ExportFormat, 'pdf'>): Buffer {
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();

  for (const section of sections) {
    const aoa = [section.headers, ...section.rows];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetNameFor(section.label, used));
  }

  const bookType = format === 'xls' ? 'biff8' : format;
  return XLSX.write(workbook, { type: 'buffer', bookType }) as Buffer;
}

function csvEscape(cell: string): string {
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

function buildSectionedCsv(sections: ExportSection[]): Buffer {
  const blocks = sections.map((section) => {
    const lines = [section.label, section.headers.join(','), ...section.rows.map((row) => row.map(csvEscape).join(','))];
    return lines.join('\n');
  });
  return Buffer.from(blocks.join('\n\n'), 'utf-8');
}

function buildSectionedPdf(sections: ExportSection[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageLeft = 40;
    const pageWidth = doc.page.width - 80;
    const pageBottom = doc.page.height - 40;

    doc.font('Helvetica-Bold').fontSize(18).text('Search Results', { align: 'left' });

    sections.forEach((section, sectionIndex) => {
      const colWidth = pageWidth / section.headers.length;
      const colX = section.headers.map((_, i) => pageLeft + i * colWidth);

      function drawHeader() {
        doc.font('Helvetica-Bold').fontSize(10);
        section.headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { continued: false, width: colWidth }));
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(9);
      }

      doc.moveDown(1);
      if (sectionIndex > 0 && doc.y > pageBottom - 100) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(13).text(section.label, { align: 'left' });
      doc.moveDown(0.5);
      drawHeader();

      for (const row of section.rows) {
        if (doc.y > pageBottom) {
          doc.addPage();
          doc.y = 40;
          drawHeader();
        }
        const y = doc.y;
        row.forEach((cell, i) => {
          doc.text(cell, colX[i], y, { width: colWidth - 8 });
        });
        doc.moveDown(0.7);
      }
    });

    doc.end();
  });
}

export async function generateSearchExport(
  data: SearchExportData,
  format: ExportFormat,
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const sections = buildSearchSections(data);
  const buffer =
    format === 'pdf'
      ? await buildSectionedPdf(sections)
      : format === 'csv'
        ? buildSectionedCsv(sections)
        : buildSectionedSpreadsheet(sections, format);
  return { buffer, contentType: CONTENT_TYPES[format], extension: format };
}
