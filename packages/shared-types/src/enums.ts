import { z } from 'zod';

export const RoleSchema = z.enum(['customer', 'account_manager', 'admin']);
export type Role = z.infer<typeof RoleSchema>;

export const AccountTypeSchema = z.enum(['savings', 'current']);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const AccountStatusSchema = z.enum(['active', 'frozen', 'closed']);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const CardStatusSchema = z.enum(['active', 'frozen', 'closed']);
export type CardStatus = z.infer<typeof CardStatusSchema>;

export const TransactionTypeSchema = z.enum([
  'deposit',
  'transfer',
  'transfer_external',
  'topup',
  'spend',
  'withdrawal',
]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const RequestTypeSchema = z.enum([
  'open_account',
  'close_account',
  'freeze_account',
  'unfreeze_account',
  'issue_debit_card',
  'close_debit_card',
  'freeze_debit_card',
  'unfreeze_debit_card',
  'issue_credit_card',
  'close_credit_card',
  'freeze_credit_card',
  'unfreeze_credit_card',
  'increase_credit_limit',
  'decrease_credit_limit',
  'withdraw_money',
]);
export type RequestType = z.infer<typeof RequestTypeSchema>;

export const RequestStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;
