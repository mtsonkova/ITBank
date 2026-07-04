import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../lib/AppError';
import { resetUserPassword } from '../services/adminService';

const router = Router();

// ─── PUT /api/v1/admin/users/:id/password ──────────────────────────────────────
router.put('/:id/password', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { newPassword } = req.body as { newPassword?: string };
    if (!newPassword) {
      throw new AppError(400, 'newPassword is required', 'MISSING_FIELDS');
    }

    await resetUserPassword(req.params.id, newPassword);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
