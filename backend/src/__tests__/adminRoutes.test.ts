import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

process.env.JWT_SECRET = 'test-secret-for-unit-tests';

vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    customerAssignment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    bankAccount: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    debitCard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    creditCard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    request: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async () => 'hashed-password'),
    compare: vi.fn(async () => true),
  },
}));

import app from '../app';
import prisma from '../lib/prisma';

const SECRET = process.env.JWT_SECRET!;
const ADMIN_ID = 'admin-1';

function makeAdminToken(): string {
  return jwt.sign({ sub: ADMIN_ID, role: 'admin', jti: randomUUID() }, SECRET, { expiresIn: '8h' });
}

function decimal(value: number) {
  return { toNumber: () => value, toString: () => value.toFixed(2) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Manager removal blocked when has clients ─────────────────────────────────
describe('DELETE /api/v1/admin/managers/:id', () => {
  it('returns 422 MANAGER_HAS_CLIENTS when the manager still has assigned clients', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'mgr-1', role: 'account_manager' });
    (prisma.customerAssignment.count as any).mockResolvedValue(2);

    const res = await request(app)
      .delete('/api/v1/admin/managers/mgr-1')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('MANAGER_HAS_CLIENTS');
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('removes the manager once client count is zero', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'mgr-1', role: 'account_manager' });
    (prisma.customerAssignment.count as any).mockResolvedValue(0);
    (prisma.user.delete as any).mockResolvedValue({});

    const res = await request(app)
      .delete('/api/v1/admin/managers/mgr-1')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'mgr-1' } });
  });
});

// ─── Bulk reassign is atomic ────────────────────────────────────────────────
describe('POST /api/v1/admin/managers/:id/reassign', () => {
  it('moves all clients from one manager to another in a single updateMany call', async () => {
    (prisma.user.findUnique as any).mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, role: 'account_manager' }),
    );
    (prisma.customerAssignment.updateMany as any).mockResolvedValue({ count: 3 });

    const res = await request(app)
      .post('/api/v1/admin/managers/mgr-1/reassign')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ toManagerId: 'mgr-2' });

    expect(res.status).toBe(200);
    expect(prisma.customerAssignment.updateMany).toHaveBeenCalledWith({
      where: { accountManagerId: 'mgr-1' },
      data: { accountManagerId: 'mgr-2' },
    });
    expect(prisma.customerAssignment.updateMany).toHaveBeenCalledTimes(1);
  });

  it('returns 422 when source and target manager are the same', async () => {
    const res = await request(app)
      .post('/api/v1/admin/managers/mgr-1/reassign')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ toManagerId: 'mgr-1' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SAME_MANAGER');
    expect(prisma.customerAssignment.updateMany).not.toHaveBeenCalled();
  });
});

// ─── Admin password reset: no current password needed ─────────────────────────
describe('PUT /api/v1/admin/users/:id/password', () => {
  it('resets the password without requiring the current password', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'cust-1', passwordHash: 'old-hash' });
    (prisma.user.update as any).mockResolvedValue({});

    const res = await request(app)
      .put('/api/v1/admin/users/cust-1/password')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ newPassword: 'NewPassword123!' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { passwordHash: 'hashed-password' },
    });
  });

  it('returns 400 when newPassword is missing', async () => {
    const res = await request(app)
      .put('/api/v1/admin/users/cust-1/password')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

// ─── Admin can approve/reject any request regardless of assigned manager ──────
describe('POST /api/v1/admin/requests/:id/approve', () => {
  it('approves a request assigned to a different manager', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-1',
      customerId: 'cust-1',
      accountManagerId: 'some-other-manager',
      type: 'freeze_account',
      status: 'pending',
      payload: { account_id: 'acct-1' },
    });
    (prisma.bankAccount.findUnique as any).mockResolvedValue({
      id: 'acct-1',
      customerId: 'cust-1',
      status: 'active',
    });
    (prisma.bankAccount.update as any).mockResolvedValue({ id: 'acct-1', status: 'frozen' });
    (prisma.request.update as any).mockResolvedValue({
      id: 'req-1',
      customerId: 'cust-1',
      accountManagerId: 'some-other-manager',
      type: 'freeze_account',
      status: 'approved',
      payload: { account_id: 'acct-1' },
      rejectionReason: null,
      createdAt: new Date(),
      actionedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/admin/requests/req-1/approve')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(prisma.bankAccount.update).toHaveBeenCalled();
  });
});

describe('POST /api/v1/admin/requests/:id/reject', () => {
  it('rejects a request assigned to a different manager', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-2',
      customerId: 'cust-1',
      accountManagerId: 'some-other-manager',
      type: 'freeze_account',
      status: 'pending',
      payload: { account_id: 'acct-1' },
    });
    (prisma.request.update as any).mockResolvedValue({
      id: 'req-2',
      customerId: 'cust-1',
      accountManagerId: 'some-other-manager',
      type: 'freeze_account',
      status: 'rejected',
      payload: { account_id: 'acct-1' },
      rejectionReason: 'Not eligible',
      createdAt: new Date(),
      actionedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/admin/requests/req-2/reject')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ reason: 'Not eligible' });

    expect(res.status).toBe(200);
    expect(res.body.data.rejectionReason).toBe('Not eligible');
  });
});

// ─── Admin can perform direct account/card operations on any client ───────────
// (via the shared managerService applySideEffect layer exercised through approve above,
// plus a credit-card example to cover a second instrument type)
describe('POST /api/v1/admin/requests/:id/approve — credit card side effect', () => {
  it('freezes a credit card belonging to a client outside any particular manager check', async () => {
    (prisma.request.findUnique as any).mockResolvedValue({
      id: 'req-3',
      customerId: 'cust-1',
      accountManagerId: 'some-other-manager',
      type: 'freeze_credit_card',
      status: 'pending',
      payload: { card_id: 'cc-1' },
    });
    (prisma.creditCard.findUnique as any).mockResolvedValue({
      id: 'cc-1',
      customerId: 'cust-1',
      status: 'active',
      creditLimit: decimal(2000),
      outstandingBalance: decimal(0),
    });
    (prisma.creditCard.update as any).mockResolvedValue({ id: 'cc-1', status: 'frozen' });
    (prisma.request.update as any).mockResolvedValue({
      id: 'req-3',
      customerId: 'cust-1',
      accountManagerId: 'some-other-manager',
      type: 'freeze_credit_card',
      status: 'approved',
      payload: { card_id: 'cc-1' },
      rejectionReason: null,
      createdAt: new Date(),
      actionedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/admin/requests/req-3/approve')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(prisma.creditCard.update).toHaveBeenCalledWith({
      where: { id: 'cc-1' },
      data: { status: 'frozen' },
    });
  });
});

// ─── DB reset disabled in production ───────────────────────────────────────────
describe('POST /api/v1/test/reset', () => {
  it('returns 404 when NODE_ENV=production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const res = await request(app).post('/api/v1/test/reset');

    expect(res.status).toBe(404);
    process.env.NODE_ENV = original;
  });
});
