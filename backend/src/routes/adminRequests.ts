import { Router } from 'express';
import { RejectRequestBodySchema } from '@banking-simulator/shared-types';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validateBody } from '../middleware/validateBody';
import { AppError } from '../lib/AppError';
import prisma from '../lib/prisma';
import type { RequestType } from '@banking-simulator/shared-types';
import { parsePayload } from '../lib/jsonPayload';
import { applySideEffect } from '../services/managerService';

const router = Router();

function serializeRequest(r: {
  id: string;
  customerId: string;
  accountManagerId: string | null;
  type: string;
  status: string;
  payload: string;
  rejectionReason: string | null;
  createdAt: Date;
  actionedAt: Date | null;
  customer?: { id: string; fullName: string; username: string };
  accountManager?: { id: string; fullName: string; username: string } | null;
}) {
  return {
    id: r.id,
    customerId: r.customerId,
    accountManagerId: r.accountManagerId,
    type: r.type,
    status: r.status,
    payload: parsePayload(r.payload),
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
    actionedAt: r.actionedAt?.toISOString() ?? null,
    customer: r.customer,
    accountManager: r.accountManager,
  };
}

// ─── GET /api/v1/admin/requests ────────────────────────────────────────────────
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };

    const requests = await prisma.request.findMany({
      where: status ? { status: status as never } : {},
      include: {
        customer: { select: { id: true, fullName: true, username: true } },
        accountManager: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: requests.map(serializeRequest) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/admin/requests/:id/approve ───────────────────────────────────
// Admin can approve any request regardless of assigned manager — the portfolio
// check that gates the manager route is intentionally skipped here.
router.post('/:id/approve', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      throw new AppError(404, 'Request not found', 'NOT_FOUND');
    }
    if (request.status !== 'pending') {
      throw new AppError(422, 'Only pending requests can be approved', 'NOT_PENDING');
    }

    await applySideEffect(request.customerId, request.type as RequestType, parsePayload(request.payload));

    const updated = await prisma.request.update({
      where: { id },
      data: { status: 'approved', actionedAt: new Date() },
    });

    res.json({ data: serializeRequest(updated) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/admin/requests/:id/reject ────────────────────────────────────
router.post('/:id/reject', authenticate, authorize('admin'), validateBody(RejectRequestBodySchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason: string };

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      throw new AppError(404, 'Request not found', 'NOT_FOUND');
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
