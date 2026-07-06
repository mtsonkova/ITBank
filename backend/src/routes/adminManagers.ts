import { Router } from 'express';
import { AddManagerBodySchema, ReassignBodySchema } from '@banking-simulator/shared-types';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validateBody } from '../middleware/validateBody';
import { listManagers, createManager, removeManager, bulkReassignManager } from '../services/adminService';

const router = Router();

function serializeManager(m: { id: string; username: string; fullName: string; createdAt: Date; clientCount: number }) {
  return {
    id: m.id,
    username: m.username,
    fullName: m.fullName,
    clientCount: m.clientCount,
    createdAt: m.createdAt.toISOString(),
  };
}

// ─── GET /api/v1/admin/managers ────────────────────────────────────────────────
router.get('/', authenticate, authorize('admin'), async (_req, res, next) => {
  try {
    const managers = await listManagers();
    res.json({ data: managers.map(serializeManager) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/admin/managers ───────────────────────────────────────────────
router.post('/', authenticate, authorize('admin'), validateBody(AddManagerBodySchema), async (req, res, next) => {
  try {
    const { fullName, username, password } = req.body as {
      fullName: string;
      username: string;
      password: string;
    };

    const manager = await createManager(fullName, username, password);
    res.status(201).json({
      data: { id: manager.id, username: manager.username, fullName: manager.fullName, role: manager.role },
      message: 'Account manager created successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/admin/managers/:id ─────────────────────────────────────────
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    await removeManager(req.params.id);
    res.json({ message: 'Account manager removed successfully' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/admin/managers/:id/reassign ──────────────────────────────────
router.post('/:id/reassign', authenticate, authorize('admin'), validateBody(ReassignBodySchema), async (req, res, next) => {
  try {
    const { toManagerId } = req.body as { toManagerId: string };

    await bulkReassignManager(req.params.id, toManagerId);
    res.json({ message: 'Clients reassigned successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
