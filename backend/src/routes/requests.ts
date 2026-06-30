import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../lib/AppError';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import type { RequestType } from '@prisma/client';

const router = Router();

const ACCOUNT_REQUEST_TYPES = new Set<RequestType>([
  'open_account',
  'close_account',
  'freeze_account',
  'unfreeze_account',
]);

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

/**
 * @openapi
 * /api/v1/requests:
 *   get:
 *     tags: [Requests]
 *     summary: Get the authenticated customer's requests
 */
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

/**
 * @openapi
 * /api/v1/requests:
 *   post:
 *     tags: [Requests]
 *     summary: Submit a new request (account-related types)
 */
router.post('/', authenticate, authorize('customer'), async (req, res, next) => {
  try {
    const customerId = req.user!.id;
    const { type, payload = {} } = req.body as {
      type?: string;
      payload?: Record<string, unknown>;
    };

    if (!type) throw new AppError(400, 'type is required', 'MISSING_FIELDS');

    if (!ACCOUNT_REQUEST_TYPES.has(type as RequestType)) {
      throw new AppError(400, `Unsupported request type: ${type}`, 'INVALID_REQUEST_TYPE');
    }

    const assignment = await prisma.customerAssignment.findUnique({ where: { customerId } });
    const accountManagerId = assignment?.accountManagerId ?? null;

    if (type !== 'open_account') {
      const accountId = payload.account_id as string | undefined;
      if (!accountId) throw new AppError(400, 'payload.account_id is required', 'MISSING_FIELDS');

      const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
      if (!account || account.customerId !== customerId) {
        throw new AppError(404, 'Account not found', 'NOT_FOUND');
      }

      if (type === 'close_account') {
        if (account.balance.toNumber() !== 0) {
          throw new AppError(422, 'Account balance must be €0.00 to request closure', 'BALANCE_NOT_ZERO');
        }
      }

      if (type === 'freeze_account' && account.status !== 'active') {
        throw new AppError(422, 'Only active accounts can be frozen', 'NOT_ACTIVE');
      }

      if (type === 'unfreeze_account' && account.status !== 'frozen') {
        throw new AppError(422, 'Only frozen accounts can be unfrozen', 'NOT_FROZEN');
      }

      // Duplicate pending check
      const pending = await prisma.request.findMany({
        where: { customerId, type: type as RequestType, status: 'pending' },
      });
      const duplicate = pending.find(
        (r) => (r.payload as Record<string, unknown>).account_id === accountId,
      );
      if (duplicate) {
        throw new AppError(
          422,
          'A pending request of this type already exists for this account',
          'DUPLICATE_PENDING',
        );
      }
    }

    const request = await prisma.request.create({
      data: {
        customerId,
        accountManagerId,
        type: type as RequestType,
        status: 'pending',
        payload: payload as Prisma.InputJsonObject,
      },
    });

    res.status(201).json({ data: serializeRequest(request) });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/requests/{id}:
 *   delete:
 *     tags: [Requests]
 *     summary: Cancel a pending request
 */
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
