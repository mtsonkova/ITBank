import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../lib/AppError';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import type { RequestType } from '@prisma/client';

const router = Router();

// ─── Supported request types by milestone ────────────────────────────────────
const ACCOUNT_TYPES = new Set<RequestType>([
  'open_account',
  'close_account',
  'freeze_account',
  'unfreeze_account',
]);

const DEBIT_CARD_TYPES = new Set<RequestType>([
  'issue_debit_card',
  'close_debit_card',
  'freeze_debit_card',
  'unfreeze_debit_card',
]);

const CREDIT_CARD_TYPES = new Set<RequestType>([
  'issue_credit_card',
  'close_credit_card',
  'freeze_credit_card',
  'unfreeze_credit_card',
  'increase_credit_limit',
  'decrease_credit_limit',
]);

const VALID_TYPES = new Set<RequestType>([
  ...ACCOUNT_TYPES,
  ...DEBIT_CARD_TYPES,
  ...CREDIT_CARD_TYPES,
  'withdraw_money',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  };
}

async function hasDuplicatePending(
  customerId: string,
  type: RequestType,
  payloadKey: string,
  payloadValue: string,
): Promise<boolean> {
  const pending = await prisma.request.findMany({
    where: { customerId, type, status: 'pending' },
    select: { payload: true },
  });
  return pending.some(
    (r) => (r.payload as Record<string, unknown>)[payloadKey] === payloadValue,
  );
}

// ─── GET /api/v1/requests ─────────────────────────────────────────────────────
router.get('/', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const requests = await prisma.request.findMany({
      where: { customerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: requests.map(serializeRequest) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/requests ────────────────────────────────────────────────────
router.post('/', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const customerId = req.user!.id;
    const { type, payload = {} } = req.body as {
      type?: string;
      payload?: Record<string, unknown>;
    };

    if (!type) throw new AppError(400, 'type is required', 'MISSING_FIELDS');
    if (!VALID_TYPES.has(type as RequestType)) {
      throw new AppError(400, `Unsupported request type: ${type}`, 'INVALID_REQUEST_TYPE');
    }

    const reqType = type as RequestType;
    const assignment = await prisma.customerAssignment.findUnique({ where: { customerId } });
    const accountManagerId = assignment?.accountManagerId ?? null;

    // ── Account request validation ──────────────────────────────────────────
    if (ACCOUNT_TYPES.has(reqType)) {
      if (reqType === 'open_account') {
        if (!['savings', 'current'].includes(payload.type as string)) {
          throw new AppError(400, 'payload.type must be savings or current', 'MISSING_FIELDS');
        }
      } else {
        const accountId = payload.account_id as string | undefined;
        if (!accountId) throw new AppError(400, 'payload.account_id is required', 'MISSING_FIELDS');

        const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
        if (!account || account.customerId !== customerId) {
          throw new AppError(404, 'Account not found', 'NOT_FOUND');
        }

        if (reqType === 'close_account' && account.balance.toNumber() !== 0) {
          throw new AppError(422, 'Account balance must be €0.00 to request closure', 'BALANCE_NOT_ZERO');
        }
        if (reqType === 'freeze_account' && account.status !== 'active') {
          throw new AppError(422, 'Only active accounts can be frozen', 'NOT_ACTIVE');
        }
        if (reqType === 'unfreeze_account' && account.status !== 'frozen') {
          throw new AppError(422, 'Only frozen accounts can be unfrozen', 'NOT_FROZEN');
        }

        if (await hasDuplicatePending(customerId, reqType, 'account_id', accountId)) {
          throw new AppError(422, 'A pending request of this type already exists for this account', 'DUPLICATE_PENDING');
        }
      }
    }

    // ── Debit card request validation ───────────────────────────────────────
    if (DEBIT_CARD_TYPES.has(reqType)) {
      if (reqType === 'issue_debit_card') {
        const accountId = payload.account_id as string | undefined;
        if (!accountId) throw new AppError(400, 'payload.account_id is required', 'MISSING_FIELDS');

        const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
        if (!account || account.customerId !== customerId) {
          throw new AppError(404, 'Account not found', 'NOT_FOUND');
        }
        if (account.status !== 'active') {
          throw new AppError(422, 'Debit card can only be issued to an active account', 'ACCOUNT_NOT_ACTIVE');
        }
        if (await hasDuplicatePending(customerId, reqType, 'account_id', accountId)) {
          throw new AppError(422, 'A pending issue request already exists for this account', 'DUPLICATE_PENDING');
        }
      } else {
        const cardId = payload.card_id as string | undefined;
        if (!cardId) throw new AppError(400, 'payload.card_id is required', 'MISSING_FIELDS');

        const card = await prisma.debitCard.findUnique({ where: { id: cardId } });
        if (!card || card.customerId !== customerId) {
          throw new AppError(404, 'Debit card not found', 'NOT_FOUND');
        }

        if (reqType === 'freeze_debit_card' && card.status !== 'active') {
          throw new AppError(422, 'Only active debit cards can be frozen', 'NOT_ACTIVE');
        }
        if (reqType === 'unfreeze_debit_card' && card.status !== 'frozen') {
          throw new AppError(422, 'Only frozen debit cards can be unfrozen', 'NOT_FROZEN');
        }

        if (reqType !== 'close_debit_card') {
          if (await hasDuplicatePending(customerId, reqType, 'card_id', cardId)) {
            throw new AppError(422, 'A pending request of this type already exists for this card', 'DUPLICATE_PENDING');
          }
        }
      }
    }

    // ── Credit card request validation ──────────────────────────────────────
    if (CREDIT_CARD_TYPES.has(reqType)) {
      if (reqType === 'issue_credit_card') {
        const existing = await prisma.creditCard.findFirst({
          where: { customerId, status: { not: 'closed' } },
        });
        if (existing) {
          throw new AppError(422, 'You already have an active or frozen credit card', 'CREDIT_CARD_EXISTS');
        }
      } else {
        const cardId = payload.card_id as string | undefined;
        if (!cardId) throw new AppError(400, 'payload.card_id is required', 'MISSING_FIELDS');

        const card = await prisma.creditCard.findUnique({ where: { id: cardId } });
        if (!card || card.customerId !== customerId) {
          throw new AppError(404, 'Credit card not found', 'NOT_FOUND');
        }

        if (reqType === 'freeze_credit_card' && card.status !== 'active') {
          throw new AppError(422, 'Only active credit cards can be frozen', 'NOT_ACTIVE');
        }
        if (reqType === 'unfreeze_credit_card' && card.status !== 'frozen') {
          throw new AppError(422, 'Only frozen credit cards can be unfrozen', 'NOT_FROZEN');
        }

        if (reqType === 'increase_credit_limit' || reqType === 'decrease_credit_limit') {
          const newLimit = payload.new_limit as number | undefined;
          if (!newLimit || newLimit <= 0) {
            throw new AppError(400, 'payload.new_limit must be a positive number', 'MISSING_FIELDS');
          }
        }

        if (await hasDuplicatePending(customerId, reqType, 'card_id', cardId)) {
          throw new AppError(422, 'A pending request of this type already exists for this card', 'DUPLICATE_PENDING');
        }
      }
    }

    // ── Withdraw money validation ────────────────────────────────────────────
    if (reqType === 'withdraw_money') {
      const accountId = payload.account_id as string | undefined;
      const amount = payload.amount as number | undefined;
      if (!accountId) throw new AppError(400, 'payload.account_id is required', 'MISSING_FIELDS');
      if (!amount || amount <= 0) throw new AppError(400, 'payload.amount must be positive', 'MISSING_FIELDS');

      const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
      if (!account || account.customerId !== customerId) {
        throw new AppError(404, 'Account not found', 'NOT_FOUND');
      }
    }

    const request = await prisma.request.create({
      data: {
        customerId,
        accountManagerId,
        type: reqType,
        status: 'pending',
        payload: payload as Prisma.InputJsonObject,
      },
    });

    res.status(201).json({ data: serializeRequest(request) });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/requests/:id ─────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await prisma.request.findUnique({ where: { id } });

    if (!request || request.customerId !== req.user!.id) {
      throw new AppError(404, 'Request not found', 'NOT_FOUND');
    }
    if (request.status !== 'pending') {
      throw new AppError(422, 'Only pending requests can be cancelled', 'NOT_PENDING');
    }

    await prisma.request.update({ where: { id }, data: { status: 'cancelled' } });
    res.json({ message: 'Request cancelled successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
