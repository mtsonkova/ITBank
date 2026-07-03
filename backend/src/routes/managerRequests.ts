import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../lib/AppError';
import prisma from '../lib/prisma';
import type { RequestType } from '@prisma/client';
import {
  openAccount,
  setAccountStatus,
  issueDebitCard,
  setDebitCardStatus,
  issueCreditCard,
  setCreditCardStatus,
  updateCreditLimit,
  withdrawMoney,
} from '../services/managerService';

const router = Router();

// New credit cards approved via a customer request carry no manager-chosen
// limit (the request payload has none) — use a conservative default.
const DEFAULT_CREDIT_LIMIT = 1000;

// ─── Side-effect dispatch table ───────────────────────────────────────────────
async function applySideEffect(
  customerId: string,
  type: RequestType,
  payload: Record<string, unknown>,
) {
  switch (type) {
    case 'open_account':
      return openAccount(customerId, payload.type as 'savings' | 'current');
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

function serializeRequest(r: {
  id: string;
  customerId: string;
  accountManagerId: string | null;
  type: RequestType;
  status: string;
  payload: unknown;
  rejectionReason: string | null;
  createdAt: Date;
  actionedAt: Date | null;
  customer?: { id: string; fullName: string; username: string };
}) {
  return {
    id: r.id,
    customerId: r.customerId,
    accountManagerId: r.accountManagerId,
    type: r.type,
    status: r.status,
    payload: r.payload,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
    actionedAt: r.actionedAt?.toISOString() ?? null,
    customer: r.customer,
  };
}

// ─── GET /api/v1/manager/requests ─────────────────────────────────────────────
router.get('/', authenticate, authorize('account_manager'), async (req, res, next) => {
  try {
    const managerId = req.user!.id;
    const { status } = req.query as { status?: string };

    const requests = await prisma.request.findMany({
      where: {
        accountManagerId: managerId,
        ...(status ? { status: status as never } : {}),
      },
      include: { customer: { select: { id: true, fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: requests.map(serializeRequest) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/manager/requests/:id/approve ────────────────────────────────
router.post('/:id/approve', authenticate, authorize('account_manager'), async (req, res, next) => {
  try {
    const managerId = req.user!.id;
    const { id } = req.params;

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      throw new AppError(404, 'Request not found', 'NOT_FOUND');
    }
    if (request.accountManagerId !== managerId) {
      throw new AppError(403, 'Request is not in your portfolio', 'FORBIDDEN');
    }
    if (request.status !== 'pending') {
      throw new AppError(422, 'Only pending requests can be approved', 'NOT_PENDING');
    }

    await applySideEffect(request.customerId, request.type, request.payload as Record<string, unknown>);

    const updated = await prisma.request.update({
      where: { id },
      data: { status: 'approved', actionedAt: new Date() },
    });

    res.json({ data: serializeRequest(updated) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/manager/requests/:id/reject ─────────────────────────────────
router.post('/:id/reject', authenticate, authorize('account_manager'), async (req, res, next) => {
  try {
    const managerId = req.user!.id;
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    if (!reason || !reason.trim()) {
      throw new AppError(400, 'reason is required', 'MISSING_FIELDS');
    }

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      throw new AppError(404, 'Request not found', 'NOT_FOUND');
    }
    if (request.accountManagerId !== managerId) {
      throw new AppError(403, 'Request is not in your portfolio', 'FORBIDDEN');
    }
    if (request.status !== 'pending') {
      throw new AppError(422, 'Only pending requests can be rejected', 'NOT_PENDING');
    }

    const updated = await prisma.request.update({
      where: { id },
      data: { status: 'rejected', rejectionReason: reason, actionedAt: new Date() },
    });

    res.json({ data: serializeRequest(updated) });
  } catch (err) {
    next(err);
  }
});

export default router;
