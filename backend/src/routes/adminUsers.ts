import { Router } from 'express';
import { AdminResetPasswordBodySchema } from '@banking-simulator/shared-types';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validateBody } from '../middleware/validateBody';
import { resetUserPassword } from '../services/adminService';

const router = Router();

// ─── PUT /api/v1/admin/users/:id/password ──────────────────────────────────────
router.put('/:id/password', authenticate, authorize('admin'), validateBody(AdminResetPasswordBodySchema), async (req, res, next) => {
  try {
    const { newPassword } = req.body as { newPassword: string };

    await resetUserPassword(req.params.id, newPassword);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
