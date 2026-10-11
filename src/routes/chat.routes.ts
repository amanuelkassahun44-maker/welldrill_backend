import { Router, Response } from 'express';
import { db } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.get('/rooms', authenticate, async (req: AuthRequest, res: Response) => {
  const result = await db.query(
    `SELECT cr.*, u1.full_name as p1_name, u1.avatar_url as p1_avatar, u2.full_name as p2_name, u2.avatar_url as p2_avatar FROM chat_rooms cr JOIN users u1 ON u1.id = cr.participant1 JOIN users u2 ON u2.id = cr.participant2 WHERE cr.participant1 = $1 OR cr.participant2 = $1`,
    [req.user!.id]
  );
  return res.json(result.rows);
});

export { router as chatRouter };
