import { NextFunction, Request, Response } from 'express';
import { Role } from '@banking-simulator/shared-types';

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
