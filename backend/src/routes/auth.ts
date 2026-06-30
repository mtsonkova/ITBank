import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/authenticate';
import { jwtBlacklist } from '../lib/jwtBlacklist';
import { AppError } from '../lib/AppError';
import prisma from '../lib/prisma';

const router = Router();

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with username and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: anna.becker
 *               password:
 *                 type: string
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Missing fields
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      throw new AppError(400, 'username and password are required', 'MISSING_FIELDS');
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const jti = randomUUID();
    const token = jwt.sign(
      { sub: user.id, role: user.role, jti },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' },
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and invalidate the current token
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', authenticate, (req, res) => {
  const { jti, exp } = req.user!;
  jwtBlacklist.add(jti, exp * 1000); // exp is seconds; blacklist stores ms
  res.json({ message: 'Logged out successfully' });
});

// ─── PUT /api/v1/auth/password ────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/auth/password:
 *   put:
 *     tags: [Auth]
 *     summary: Change the authenticated user's password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Missing fields or wrong current password
 *       401:
 *         description: Unauthorized
 */
router.put('/password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      throw new AppError(400, 'currentPassword and newPassword are required', 'MISSING_FIELDS');
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      throw new AppError(400, 'Current password is incorrect', 'WRONG_PASSWORD');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
