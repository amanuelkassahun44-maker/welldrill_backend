import { Router, Response } from 'express';
import { db } from '../config/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { category, min_price, max_price, limit = 20, offset = 0 } = req.query;
  let query = `SELECT l.*, u.full_name as seller_name, u.is_verified, r.name_en as region FROM listings l JOIN users u ON u.id = l.seller_id LEFT JOIN regions r ON r.id = l.region_id WHERE l.is_available = true AND l.is_approved = true`;
  const params: unknown[] = [];
  let idx = 1;
  if (category) { query += ` AND l.category = $${idx++}`; params.push(category); }
  if (min_price) { query += ` AND l.price >= $${idx++}`; params.push(min_price); }
  if (max_price) { query += ` AND l.price <= $${idx++}`; params.push(max_price); }
  query += ` ORDER BY l.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);
  const result = await db.query(query, params);
  return res.json(result.rows);
});

router.post('/', authenticate, requireRole('provider'), async (req: AuthRequest, res: Response) => {
  const { title, description, category, price, condition, images, region_id } = req.body;
  const result = await db.query(
    `INSERT INTO listings (seller_id, title, description, category, price, condition, images, region_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.user!.id, title, description, category, price, condition, images, region_id]
  );
  return res.status(201).json(result.rows[0]);
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await db.query('UPDATE listings SET is_available = false WHERE id = $1 AND seller_id = $2', [id, req.user!.id]);
  return res.json({ success: true });
});

export { router as marketplaceRouter };
