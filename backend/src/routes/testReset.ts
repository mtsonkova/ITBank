import { Router } from 'express';
import prisma from '../lib/prisma';
import { seedDatabase } from '../lib/seedDatabase';

const router = Router();

// ─── POST /api/v1/test/reset ───────────────────────────────────────────────────
router.post('/reset', async (_req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    return;
  }

  try {
    await seedDatabase(prisma);
    res.json({ message: 'Database reset successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
