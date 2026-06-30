import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

// Must be set before app is imported so route handlers can read it
process.env.JWT_SECRET = 'test-secret-for-unit-tests';

vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import app from '../app';
import prisma from '../lib/prisma';

const SECRET = process.env.JWT_SECRET;

// Generates a fresh token with a unique jti each call to avoid blacklist collisions
function makeToken(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    { sub: 'user-1', role: 'customer', jti: randomUUID(), ...overrides },
    SECRET,
    { expiresIn: '8h' },
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  let passwordHash: string;

  beforeAll(async () => {
    // cost 4 keeps the suite fast while still exercising the real bcrypt path
    passwordHash = await bcrypt.hash('Password123!', 4);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with token and user on valid credentials', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-1',
      username: 'anna.becker',
      role: 'customer',
      fullName: 'Anna Becker',
      passwordHash,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'anna.becker', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      token: expect.any(String),
      user: {
        id: 'user-1',
        username: 'anna.becker',
        role: 'customer',
        fullName: 'Anna Becker',
      },
    });
  });

  it('returns 401 with INVALID_CREDENTIALS on wrong password', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-1',
      username: 'anna.becker',
      role: 'customer',
      fullName: 'Anna Becker',
      passwordHash,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'anna.becker', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 400 with MISSING_FIELDS when password is absent', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'anna.becker' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });
});

// ─── JWT middleware (tested via the logout endpoint) ─────────────────────────

describe('JWT middleware via POST /api/v1/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a valid Bearer token and returns 200', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
  });

  it('returns 401 with UNAUTHORIZED when Authorization header is missing', async () => {
    const res = await request(app).post('/api/v1/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with TOKEN_EXPIRED for an already-expired token', async () => {
    // Putting exp directly in the payload bypasses the expiresIn option
    const expiredToken = jwt.sign(
      {
        sub: 'user-1',
        role: 'customer',
        jti: randomUUID(),
        exp: Math.floor(Date.now() / 1000) - 3600,
      },
      SECRET,
    );

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });
});

// ─── Password change ──────────────────────────────────────────────────────────

describe('PUT /api/v1/auth/password', () => {
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Password123!', 4);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 when current password is correct', async () => {
    (prisma.user.findUniqueOrThrow as any).mockResolvedValue({
      id: 'user-1',
      username: 'anna.becker',
      role: 'customer',
      fullName: 'Anna Becker',
      passwordHash,
    });
    (prisma.user.update as any).mockResolvedValue({});

    const res = await request(app)
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword456!' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password changed successfully');
  });

  it('returns 400 with WRONG_PASSWORD when current password is incorrect', async () => {
    (prisma.user.findUniqueOrThrow as any).mockResolvedValue({
      id: 'user-1',
      username: 'anna.becker',
      role: 'customer',
      fullName: 'Anna Becker',
      passwordHash,
    });

    const res = await request(app)
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ currentPassword: 'WrongPassword!', newPassword: 'NewPassword456!' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WRONG_PASSWORD');
  });

  it('returns 400 with MISSING_FIELDS when newPassword is absent', async () => {
    const res = await request(app)
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ currentPassword: 'Password123!' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });
});
