import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@banking-simulator/shared-types';
import { jwtBlacklist } from '../lib/jwtBlacklist';

interface JwtPayload {
  sub: string;
  role: Role;
  jti: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; jti: string };
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' });
    return;
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    if (jwtBlacklist.has(payload.jti)) {
      res.status(401).json({ error: 'Token has been invalidated', code: 'TOKEN_REVOKED' });
      return;
    }

    req.user = { id: payload.sub, role: payload.role, jti: payload.jti };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
}
