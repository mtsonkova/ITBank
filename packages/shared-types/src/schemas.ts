import { z } from 'zod';
import {
  RoleSchema,
  AccountTypeSchema,
  AccountStatusSchema,
  CardStatusSchema,
  TransactionTypeSchema,
  RequestTypeSchema,
  RequestStatusSchema,
} from './enums';

// Monetary amounts are serialised as strings to avoid floating-point drift.
// Parse with parseFloat / Intl.NumberFormat on the frontend.

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: RoleSchema,
  fullName: z.string(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const BankAccountSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  iban: z.string(),
  type: AccountTypeSchema,
  status: AccountStatusSchema,
  balance: z.string(),
  createdAt: z.string().datetime(),
});
export type BankAccount = z.infer<typeof BankAccountSchema>;

export const DebitCardSchema = z.object({
  id: z.string().uuid(),
  bankAccountId: z.string().uuid(),
  customerId: z.string().uuid(),
  status: CardStatusSchema,
  createdAt: z.string().datetime(),
});
export type DebitCard = z.infer<typeof DebitCardSchema>;

export const CreditCardSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  status: CardStatusSchema,
  creditLimit: z.string(),
  outstandingBalance: z.string(),
  createdAt: z.string().datetime(),
});
export type CreditCard = z.infer<typeof CreditCardSchema>;

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  type: TransactionTypeSchema,
  fromAccountId: z.string().uuid().nullable(),
  toAccountId: z.string().uuid().nullable(),
  fromCardId: z.string().uuid().nullable(),
  toCardId: z.string().uuid().nullable(),
  debitCardId: z.string().uuid().nullable(),
  amount: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

// Instrument reference attached to a history row for display (label is built client-side)
export const InstrumentRefSchema = z.object({
  kind: z.enum(['account', 'debit_card', 'credit_card']),
  id: z.string().uuid(),
  iban: z.string().nullable(),
  accountType: AccountTypeSchema.nullable(),
});
export type InstrumentRef = z.infer<typeof InstrumentRefSchema>;

// A single row in a transaction history table (customer/manager/admin history pages)
export const TransactionHistoryItemSchema = z.object({
  id: z.string().uuid(),
  type: TransactionTypeSchema,
  amount: z.string(), // signed relative to the viewer's perspective, e.g. "-45.00" or "45.00"
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  instrument: InstrumentRefSchema.nullable(),
  counterpart: InstrumentRefSchema.nullable(),
});
export type TransactionHistoryItem = z.infer<typeof TransactionHistoryItemSchema>;

// A single row in the search results "cards" group — debit and credit cards merged,
// discriminated by cardType since the two Prisma models don't share a table.
export const SearchCardItemSchema = z.object({
  id: z.string().uuid(),
  cardType: z.enum(['debit', 'credit']),
  customerId: z.string().uuid(),
  status: CardStatusSchema,
  iban: z.string().nullable(), // linked account IBAN, debit cards only
  creditLimit: z.string().nullable(), // credit cards only
  outstandingBalance: z.string().nullable(), // credit cards only
  createdAt: z.string().datetime(),
});
export type SearchCardItem = z.infer<typeof SearchCardItemSchema>;

// A row in the search results "managers" group (admin scope only)
export const SearchManagerItemSchema = UserSchema.extend({
  clientCount: z.number().int(),
});
export type SearchManagerItem = z.infer<typeof SearchManagerItemSchema>;

export const RequestSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  // Auto-filled from customer's assigned manager at request creation time
  accountManagerId: z.string().uuid().nullable(),
  type: RequestTypeSchema,
  status: RequestStatusSchema,
  payload: z.record(z.unknown()),
  rejectionReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  actionedAt: z.string().datetime().nullable(),
});
export type Request = z.infer<typeof RequestSchema>;
