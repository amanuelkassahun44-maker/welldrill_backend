import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { db } from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    firebase_uid: string;
    role: 'client' | 'provider' | 'admin';
    email?: string;
    is_verified: boolean;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    // Verify Firebase ID token
    const decoded = await auth.verifyIdToken(token);

    // Get user from DB
    const result = await db.query(
      'SELECT id, firebase_uid, role, email, is_verified, is_active FROM users WHERE firebase_uid = $1',
      [decoded.uid]
    );

    if (!result.rows[0]) return res.status(401).json({ error: 'User not found' });
    if (!result.rows[0].is_active) return res.status(403).json({ error: 'Account suspended' });

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
