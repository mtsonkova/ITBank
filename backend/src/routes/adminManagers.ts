import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../lib/AppError';
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
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { fullName, username, password } = req.body as {
      fullName?: string;
      username?: string;
      password?: string;
    };

    if (!fullName || !username || !password) {
      throw new AppError(400, 'fullName, username and password are required', 'MISSING_FIELDS');
    }

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
router.post('/:id/reassign', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { toManagerId } = req.body as { toManagerId?: string };
    if (!toManagerId) {
      throw new AppError(400, 'toManagerId is required', 'MISSING_FIELDS');
    }

    await bulkReassignManager(req.params.id, toManagerId);
    res.json({ message: 'Clients reassigned successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
