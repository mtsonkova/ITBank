import prisma from '../lib/prisma';
import { AppError } from '../lib/AppError';
import { generateIBAN } from '../lib/iban';
import type { AccountType, RequestType } from '@banking-simulator/shared-types';

type Status = 'active' | 'frozen' | 'closed';

// New credit cards approved via a customer request carry no manager-chosen
// limit (the request payload has none) — use a conservative default.
const DEFAULT_CREDIT_LIMIT = 1000;

// ─── Portfolio scoping ──────────────────────────────────────────────────────
export async function requireClientInPortfolio(managerId: string, customerId: string) {
  const assignment = await prisma.customerAssignment.findUnique({ where: { customerId } });
  if (!assignment || assignment.accountManagerId !== managerId) {
    throw new AppError(403, 'Client is not in your portfolio', 'FORBIDDEN');
  }
  return assignment;
}

// ─── Status transition validation (shared by accounts, debit + credit cards) ──
function assertTransition(current: string, target: Status) {
  if (current === target) {
    throw new AppError(422, `Already ${target}`, 'INVALID_TRANSITION');
  }
  if (target === 'frozen' && current !== 'active') {
    throw new AppError(422, 'Only active items can be frozen', 'NOT_ACTIVE');
  }
  if (target === 'active' && current !== 'frozen') {
    throw new AppError(422, 'Only frozen items can be unfrozen', 'NOT_FROZEN');
  }
  if (target === 'closed' && current === 'closed') {
    throw new AppError(422, 'Already closed', 'ALREADY_CLOSED');
  }
}

// ─── Request approval side-effect dispatch ─────────────────────────────────
// Shared by the manager and admin approval routes so both call into the same
// business-rule validation instead of duplicating it.
export async function applySideEffect(
  customerId: string,
  type: RequestType,
  payload: Record<string, unknown>,
) {
  switch (type) {
    case 'open_account':
      return openAccount(customerId, payload.type as AccountType);
    case 'close_account':
      return setAccountStatus(customerId, payload.account_id as string, 'closed');
    case 'freeze_account':
      return setAccountStatus(customerId, payload.account_id as string, 'frozen');
    case 'unfreeze_account':
      return setAccountStatus(customerId, payload.account_id as string, 'active');
    case 'issue_debit_card':
      return issueDebitCard(customerId, payload.account_id as string);
    case 'close_debit_card':
      return setDebitCardStatus(customerId, payload.card_id as string, 'closed');
    case 'freeze_debit_card':
      return setDebitCardStatus(customerId, payload.card_id as string, 'frozen');
    case 'unfreeze_debit_card':
      return setDebitCardStatus(customerId, payload.card_id as string, 'active');
    case 'issue_credit_card':
      return issueCreditCard(customerId, DEFAULT_CREDIT_LIMIT);
    case 'close_credit_card':
      return setCreditCardStatus(customerId, payload.card_id as string, 'closed');
    case 'freeze_credit_card':
      return setCreditCardStatus(customerId, payload.card_id as string, 'frozen');
    case 'unfreeze_credit_card':
      return setCreditCardStatus(customerId, payload.card_id as string, 'active');
    case 'increase_credit_limit':
    case 'decrease_credit_limit':
      return updateCreditLimit(customerId, payload.card_id as string, payload.new_limit as number);
    case 'withdraw_money':
      return withdrawMoney(customerId, payload.account_id as string, payload.amount as number);
    default:
      throw new AppError(400, `Unsupported request type: ${type}`, 'INVALID_REQUEST_TYPE');
  }
}

// ─── Bank accounts ──────────────────────────────────────────────────────────
export async function openAccount(customerId: string, type: AccountType) {
  return prisma.bankAccount.create({
    data: { customerId, iban: generateIBAN(), type, status: 'active', balance: 0 },
  });
}

export async function setAccountStatus(customerId: string, accountId: string, status: Status) {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account || account.customerId !== customerId) {
    throw new AppError(404, 'Account not found', 'NOT_FOUND');
  }
  assertTransition(account.status, status);
  if (status === 'closed' && account.balance.toNumber() !== 0) {
    throw new AppError(422, 'Account balance must be €0.00 to close', 'BALANCE_NOT_ZERO');
  }
  return prisma.bankAccount.update({ where: { id: accountId }, data: { status } });
}

// ─── Debit cards ────────────────────────────────────────────────────────────
export async function issueDebitCard(customerId: string, accountId: string) {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account || account.customerId !== customerId) {
    throw new AppError(404, 'Account not found', 'NOT_FOUND');
  }
  if (account.status !== 'active') {
    throw new AppError(422, 'Debit card can only be issued to an active account', 'ACCOUNT_NOT_ACTIVE');
  }
  return prisma.debitCard.create({
    data: { bankAccountId: accountId, customerId, status: 'active' },
  });
}

export async function setDebitCardStatus(customerId: string, cardId: string, status: Status) {
  const card = await prisma.debitCard.findUnique({ where: { id: cardId } });
  if (!card || card.customerId !== customerId) {
    throw new AppError(404, 'Debit card not found', 'NOT_FOUND');
  }
  assertTransition(card.status, status);
  return prisma.debitCard.update({ where: { id: cardId }, data: { status } });
}

// ─── Credit cards ───────────────────────────────────────────────────────────
export async function issueCreditCard(customerId: string, creditLimit: number) {
  const existing = await prisma.creditCard.findFirst({
    where: { customerId, status: { not: 'closed' } },
  });
  if (existing) {
    throw new AppError(422, 'Customer already has an active or frozen credit card', 'CREDIT_CARD_EXISTS');
  }
  return prisma.creditCard.create({
    data: { customerId, status: 'active', creditLimit, outstandingBalance: 0 },
  });
}

export async function setCreditCardStatus(customerId: string, cardId: string, status: Status) {
  const card = await prisma.creditCard.findUnique({ where: { id: cardId } });
  if (!card || card.customerId !== customerId) {
    throw new AppError(404, 'Credit card not found', 'NOT_FOUND');
  }
  assertTransition(card.status, status);
  if (status === 'closed' && card.outstandingBalance.toNumber() < card.creditLimit.toNumber()) {
    throw new AppError(422, 'Credit card balance must be fully restored (≥ credit limit) to close', 'BALANCE_BELOW_LIMIT');
  }
  return prisma.creditCard.update({ where: { id: cardId }, data: { status } });
}

export async function updateCreditLimit(customerId: string, cardId: string, newLimit: number) {
  const card = await prisma.creditCard.findUnique({ where: { id: cardId } });
  if (!card || card.customerId !== customerId) {
    throw new AppError(404, 'Credit card not found', 'NOT_FOUND');
  }
  return prisma.creditCard.update({ where: { id: cardId }, data: { creditLimit: newLimit } });
}

// ─── Withdraw money ─────────────────────────────────────────────────────────
export async function withdrawMoney(customerId: string, accountId: string, amount: number) {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account || account.customerId !== customerId) {
    throw new AppError(404, 'Account not found', 'NOT_FOUND');
  }
  if (account.status !== 'active') {
    throw new AppError(422, 'Account is not active', 'ACCOUNT_NOT_ACTIVE');
  }
  if (account.balance.toNumber() < amount) {
    throw new AppError(422, 'Insufficient funds', 'INSUFFICIENT_FUNDS');
  }
  await prisma.$transaction([
    prisma.bankAccount.update({ where: { id: accountId }, data: { balance: { decrement: amount } } }),
    prisma.transaction.create({
      data: { type: 'withdrawal', fromAccountId: accountId, amount, description: 'Cash withdrawal' },
    }),
  ]);
}

// ─── Client deletion ────────────────────────────────────────────────────────
export async function checkDeletionConditions(customerId: string): Promise<string[]> {
  const [debitCards, creditCards, accounts] = await Promise.all([
    prisma.debitCard.findMany({ where: { customerId } }),
    prisma.creditCard.findMany({ where: { customerId } }),
    prisma.bankAccount.findMany({ where: { customerId } }),
  ]);

  const unmet: string[] = [];

  if (debitCards.some((c) => c.status === 'active')) {
    unmet.push('debit_cards_not_disabled');
  }
  if (creditCards.some((c) => c.status === 'active')) {
    unmet.push('credit_cards_not_disabled');
  }
  if (creditCards.some((c) => c.outstandingBalance.toNumber() < c.creditLimit.toNumber())) {
    unmet.push('credit_card_balance_below_limit');
  }
  if (accounts.some((a) => a.balance.toNumber() !== 0)) {
    unmet.push('account_balance_not_zero');
  }

  return unmet;
}

export async function deleteClient(customerId: string) {
  const [accounts, debitCards, creditCards] = await Promise.all([
    prisma.bankAccount.findMany({ where: { customerId }, select: { id: true } }),
    prisma.debitCard.findMany({ where: { customerId }, select: { id: true } }),
    prisma.creditCard.findMany({ where: { customerId }, select: { id: true } }),
  ]);
  const accountIds = accounts.map((a) => a.id);
  const debitCardIds = debitCards.map((c) => c.id);
  const creditCardIds = creditCards.map((c) => c.id);

  await prisma.$transaction([
    // Detach transaction history from the customer's own instruments so
    // deleting those instruments doesn't violate FK constraints — a
    // counterparty's side of a cross-customer transfer is left untouched.
    prisma.transaction.updateMany({ where: { fromAccountId: { in: accountIds } }, data: { fromAccountId: null } }),
    prisma.transaction.updateMany({ where: { toAccountId: { in: accountIds } }, data: { toAccountId: null } }),
    prisma.transaction.updateMany({ where: { fromCardId: { in: debitCardIds } }, data: { fromCardId: null } }),
    prisma.transaction.updateMany({ where: { debitCardId: { in: debitCardIds } }, data: { debitCardId: null } }),
    prisma.transaction.updateMany({ where: { toCardId: { in: creditCardIds } }, data: { toCardId: null } }),

    prisma.debitCard.deleteMany({ where: { customerId } }),
    prisma.creditCard.deleteMany({ where: { customerId } }),
    prisma.bankAccount.deleteMany({ where: { customerId } }),
    prisma.request.deleteMany({ where: { customerId } }),
    prisma.customerAssignment.deleteMany({ where: { customerId } }),
    prisma.user.delete({ where: { id: customerId } }),
  ]);
}
