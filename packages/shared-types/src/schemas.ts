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
