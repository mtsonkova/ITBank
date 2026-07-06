import { z } from 'zod';

// Request-body schemas for every POST/PUT/PATCH endpoint. Shared between backend
// (server-side enforcement via validateBody) and frontend (client-side inline
// field validation) so the rules live in exactly one place. Business-rule checks
// that depend on database state (insufficient funds, duplicate pending requests,
// account must be active, etc.) are NOT modeled here — those stay as 422 checks
// in the route handlers.

const INSTRUMENT_TYPES = ['account', 'debit_card', 'credit_card'] as const;
const TOPUP_SOURCE_TYPES = ['account', 'debit_card'] as const;
const INSTRUMENT_STATUSES = ['active', 'frozen', 'closed'] as const;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const LoginBodySchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required'),
});
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>;

export const AdminResetPasswordBodySchema = z.object({
  newPassword: z.string().min(1, 'New password is required'),
});
export type AdminResetPasswordBody = z.infer<typeof AdminResetPasswordBodySchema>;

// ─── Transactions ─────────────────────────────────────────────────────────────
export const SpendBodySchema = z.object({
  source_type: z.enum(INSTRUMENT_TYPES, { message: 'source_type must be account, debit_card or credit_card' }),
  source_id: z.string().min(1, 'source_id is required'),
  amount: z.coerce.number({ message: 'amount is required' }),
  description: z.string().optional(),
});
export type SpendBody = z.infer<typeof SpendBodySchema>;

export const TopUpBodySchema = z.object({
  from_type: z.enum(TOPUP_SOURCE_TYPES, { message: 'from_type must be account or debit_card' }),
  from_id: z.string().min(1, 'from_id is required'),
  to_card_id: z.string().min(1, 'to_card_id is required'),
  amount: z.coerce.number({ message: 'amount is required' }),
});
export type TopUpBody = z.infer<typeof TopUpBodySchema>;

export const DepositBodySchema = z.object({
  account_id: z.string().min(1, 'account_id is required'),
  amount: z.coerce.number({ message: 'amount is required' }),
});
export type DepositBody = z.infer<typeof DepositBodySchema>;

export const TransferBodySchema = z.object({
  from_type: z.enum(INSTRUMENT_TYPES, { message: 'Invalid instrument type' }),
  from_id: z.string().min(1, 'from_id is required'),
  to_type: z.enum(INSTRUMENT_TYPES, { message: 'Invalid instrument type' }),
  to_id: z.string().min(1, 'to_id is required'),
  amount: z.coerce.number({ message: 'amount is required' }),
  note: z.string().optional(),
});
export type TransferBody = z.infer<typeof TransferBodySchema>;

export const TransferExternalBodySchema = z.object({
  from_account_id: z.string().min(1, 'from_account_id is required'),
  to_iban: z.string().min(1, 'to_iban is required'),
  amount: z.coerce.number({ message: 'amount is required' }),
});
export type TransferExternalBody = z.infer<typeof TransferExternalBodySchema>;

// ─── Requests (customer create + manager/admin reject) ───────────────────────
const OpenAccountPayloadSchema = z.object({ type: z.enum(['savings', 'current'], { message: 'payload.type must be savings or current' }) });
const AccountIdPayloadSchema = z.object({ account_id: z.string().min(1, 'payload.account_id is required') });
const CardIdPayloadSchema = z.object({ card_id: z.string().min(1, 'payload.card_id is required') });
const CreditLimitPayloadSchema = z.object({
  card_id: z.string().min(1, 'payload.card_id is required'),
  new_limit: z.coerce.number({ message: 'payload.new_limit is required' }).positive('payload.new_limit must be a positive number'),
});
const WithdrawMoneyPayloadSchema = z.object({
  account_id: z.string().min(1, 'payload.account_id is required'),
  amount: z.coerce.number({ message: 'payload.amount is required' }).positive('payload.amount must be positive'),
});
const EmptyPayloadSchema = z.object({}).catchall(z.unknown());

export const CreateRequestBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('open_account'), payload: OpenAccountPayloadSchema }),
  z.object({ type: z.literal('close_account'), payload: AccountIdPayloadSchema }),
  z.object({ type: z.literal('freeze_account'), payload: AccountIdPayloadSchema }),
  z.object({ type: z.literal('unfreeze_account'), payload: AccountIdPayloadSchema }),
  z.object({ type: z.literal('issue_debit_card'), payload: AccountIdPayloadSchema }),
  z.object({ type: z.literal('close_debit_card'), payload: CardIdPayloadSchema }),
  z.object({ type: z.literal('freeze_debit_card'), payload: CardIdPayloadSchema }),
  z.object({ type: z.literal('unfreeze_debit_card'), payload: CardIdPayloadSchema }),
  z.object({ type: z.literal('issue_credit_card'), payload: EmptyPayloadSchema }),
  z.object({ type: z.literal('close_credit_card'), payload: CardIdPayloadSchema }),
  z.object({ type: z.literal('freeze_credit_card'), payload: CardIdPayloadSchema }),
  z.object({ type: z.literal('unfreeze_credit_card'), payload: CardIdPayloadSchema }),
  z.object({ type: z.literal('increase_credit_limit'), payload: CreditLimitPayloadSchema }),
  z.object({ type: z.literal('decrease_credit_limit'), payload: CreditLimitPayloadSchema }),
  z.object({ type: z.literal('withdraw_money'), payload: WithdrawMoneyPayloadSchema }),
], { message: 'Unsupported or missing request type' });
export type CreateRequestBody = z.infer<typeof CreateRequestBodySchema>;

export const RejectRequestBodySchema = z.object({
  reason: z.string().trim().min(1, 'Rejection reason is required'),
});
export type RejectRequestBody = z.infer<typeof RejectRequestBodySchema>;

// ─── Manager — clients ────────────────────────────────────────────────────────
export const AddClientBodySchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export type AddClientBody = z.infer<typeof AddClientBodySchema>;

export const OpenClientAccountBodySchema = z.object({
  type: z.enum(['savings', 'current'], { message: 'type must be savings or current' }),
});
export type OpenClientAccountBody = z.infer<typeof OpenClientAccountBodySchema>;

export const SetInstrumentStatusBodySchema = z.object({
  status: z.enum(INSTRUMENT_STATUSES, { message: 'status must be active, frozen or closed' }),
});
export type SetInstrumentStatusBody = z.infer<typeof SetInstrumentStatusBodySchema>;

export const IssueDebitCardBodySchema = z.object({
  account_id: z.string().min(1, 'account_id is required'),
});
export type IssueDebitCardBody = z.infer<typeof IssueDebitCardBodySchema>;

export const IssueCreditCardBodySchema = z.object({
  credit_limit: z.coerce.number({ message: 'credit_limit is required' }).positive('credit_limit must be a positive number'),
});
export type IssueCreditCardBody = z.infer<typeof IssueCreditCardBodySchema>;

// ─── Admin ────────────────────────────────────────────────────────────────────
export const AddManagerBodySchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export type AddManagerBody = z.infer<typeof AddManagerBodySchema>;

export const AddCustomerAdminBodySchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  managerId: z.string().min(1, 'Account manager is required'),
});
export type AddCustomerAdminBody = z.infer<typeof AddCustomerAdminBodySchema>;

export const ReassignBodySchema = z.object({
  toManagerId: z.string().min(1, 'toManagerId is required'),
});
export type ReassignBody = z.infer<typeof ReassignBodySchema>;
