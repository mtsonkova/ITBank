import type { BankAccount, SearchCardItem, SearchManagerItem, User } from '@banking-simulator/shared-types';
import { formatCurrency, formatIBAN, formatDateTime } from '../../lib/formatters';

const ROLE_LABELS: Record<string, string> = {
  customer: 'Customer',
  account_manager: 'Account Manager',
  admin: 'Admin',
};

export function accountRow(a: BankAccount): string[] {
  return [
    formatIBAN(a.iban),
    a.type.charAt(0).toUpperCase() + a.type.slice(1),
    a.status.charAt(0).toUpperCase() + a.status.slice(1),
    formatCurrency(a.balance),
    formatDateTime(a.createdAt),
  ];
}

export function cardRow(c: SearchCardItem): string[] {
  return [
    c.cardType === 'debit' ? 'Debit' : 'Credit',
    c.iban ? formatIBAN(c.iban) : '—',
    c.status.charAt(0).toUpperCase() + c.status.slice(1),
    c.creditLimit ? formatCurrency(c.creditLimit) : '—',
    c.outstandingBalance ? formatCurrency(c.outstandingBalance) : '—',
    formatDateTime(c.createdAt),
  ];
}

export function userRow(u: User): string[] {
  return [u.fullName, u.username, ROLE_LABELS[u.role] ?? u.role, formatDateTime(u.createdAt)];
}

export function managerRow(m: SearchManagerItem): string[] {
  return [m.fullName, m.username, String(m.clientCount), formatDateTime(m.createdAt)];
}
