import { Router } from 'express';
import { AddCustomerAdminBodySchema, ReassignBodySchema } from '@banking-simulator/shared-types';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validateBody } from '../middleware/validateBody';
import { listCustomers, createCustomer, reassignCustomer } from '../services/adminService';

const router = Router();

function serializeCustomer(c: {
  id: string;
  username: string;
  fullName: string;
  createdAt: Date;
  managerId: string | null;
  managerName: string | null;
}) {
  return {
    id: c.id,
    username: c.username,
    fullName: c.fullName,
    createdAt: c.createdAt.toISOString(),
    managerId: c.managerId,
    managerName: c.managerName,
  };
}

// ─── GET /api/v1/admin/customers ───────────────────────────────────────────────
router.get('/', authenticate, authorize('admin'), async (_req, res, next) => {
  try {
    const customers = await listCustomers();
    res.json({ data: customers.map(serializeCustomer) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/admin/customers ──────────────────────────────────────────────
router.post('/', authenticate, authorize('admin'), validateBody(AddCustomerAdminBodySchema), async (req, res, next) => {
  try {
    const { fullName, username, password, managerId } = req.body as {
      fullName: string;
      username: string;
      password: string;
      managerId: string;
    };

    const customer = await createCustomer(fullName, username, password, managerId);
    res.status(201).json({
      data: { id: customer.id, username: customer.username, fullName: customer.fullName, role: customer.role },
      message: 'Customer created successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/v1/admin/customers/:id/reassign ────────────────────────────────
router.patch('/:id/reassign', authenticate, authorize('admin'), validateBody(ReassignBodySchema), async (req, res, next) => {
  try {
    const { toManagerId } = req.body as { toManagerId: string };

    await reassignCustomer(req.params.id, toManagerId);
    res.json({ message: 'Customer reassigned successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
