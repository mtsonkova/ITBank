import { z } from 'zod';
import { RoleSchema } from './enums';

// Generic success envelope — wrap any response shape: apiSuccess(MySchema)
export function apiSuccess<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({ data: dataSchema });
}

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// Auth
export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: RoleSchema,
  fullName: z.string(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: AuthUserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// Generic { message } response used by logout and password change
export const MessageResponseSchema = z.object({
  message: z.string(),
});
export type MessageResponse = z.infer<typeof MessageResponseSchema>;

// Insufficient-funds error body (used by transfer + spend endpoints)
export const InsufficientFundsErrorSchema = z.object({
  error: z.string(),
  code: z.literal('INSUFFICIENT_FUNDS'),
  availableBalance: z.string(),
  requiredAmount: z.string(),
  topUpSources: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.enum(['account', 'debit_card']),
      label: z.string(),
      status: z.enum(['active', 'frozen']),
      balance: z.string(),
    })
  ),
});
export type InsufficientFundsError = z.infer<typeof InsufficientFundsErrorSchema>;

// Paginated list envelope (used by history + search endpoints)
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
  });
