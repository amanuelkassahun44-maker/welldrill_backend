import { Router, Response } from 'express';
import { db } from '../config/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

// GET /api/admin/users — List ALL users with real phone numbers
router.get('/users', async (req: AuthRequest, res: Response) => {
  const { role, is_verified, search, limit = 50, offset = 0 } = req.query;
  let query = `SELECT u.id, u.full_name, u.email, u.phone_raw, u.phone_masked, u.role,
                      u.is_verified, u.is_active, u.created_at,
                      pp.business_name, pp.rig_types, pp.wallet_balance, pp.star_rating
               FROM users u LEFT JOIN provider_profiles pp ON pp.user_id = u.id WHERE 1=1`;
  const params: unknown[] = [];
  let idx = 1;
  if (role) { query += ` AND u.role = $${idx++}`; params.push(role); }
  if (is_verified !== undefined) { query += ` AND u.is_verified = $${idx++}`; params.push(is_verified === 'true'); }
  if (search) { query += ` AND (u.full_name ILIKE $${idx++} OR u.email ILIKE $${idx} OR u.phone_raw ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
  query += ` ORDER BY u.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);
  const result = await db.query(query, params);
  return res.json(result.rows);
});

// PUT /api/admin/users/:id/verify — Grant Blue Tick
router.put('/users/:id/verify', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await db.query('UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1', [id]);
  await db.query(
    `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
     VALUES ($1, 'grant_blue_tick', 'user', $2, $3)`,
    [req.user!.id, id, JSON.stringify({ action: 'verification granted' })]
  );
  return res.json({ success: true, message: 'Blue tick granted ✔' });
});

// PUT /api/admin/users/:id/ban — Ban a user
router.put('/users/:id/ban', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  await db.query('UPDATE users SET is_active = false WHERE id = $1', [id]);
  await db.query(
    `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
     VALUES ($1, 'ban_user', 'user', $2, $3)`,
    [req.user!.id, id, JSON.stringify({ reason })]
  );
  return res.json({ success: true, message: 'User banned' });
});

// PUT /api/admin/users/:id/make-admin — Promote to admin
router.put('/users/:id/make-admin', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [id]);
  await db.query(
    `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
     VALUES ($1, 'promote_admin', 'user', $2, $3)`,
    [req.user!.id, id, JSON.stringify({ promoted_by: req.user!.id })]
  );
  return res.json({ success: true, message: 'User promoted to admin' });
});

// GET /api/admin/analytics — Dashboard stats
router.get('/analytics', async (_req: AuthRequest, res: Response) => {
  const [users, orders, commission, violations, posts] = await Promise.all([
    db.query(`SELECT role, COUNT(*) as count FROM users GROUP BY role`),
    db.query(`SELECT payment_status, COUNT(*) as count, SUM(total_amount) as total FROM orders GROUP BY payment_status`),
    db.query(`SELECT SUM(platform_commission) as total_commission FROM orders WHERE payment_status IN ('advance_paid','completed')`),
    db.query(`SELECT violation_type, COUNT(*) as count FROM chat_violations GROUP BY violation_type`),
    db.query(`SELECT ai_moderation, COUNT(*) as count FROM posts GROUP BY ai_moderation`),
  ]);
  return res.json({
    users: users.rows,
    orders: orders.rows,
    total_commission: commission.rows[0]?.total_commission || 0,
    chat_violations: violations.rows,
    posts_moderation: posts.rows,
  });
});

// GET /api/admin/violations — Chat violation log
router.get('/violations', async (_req: AuthRequest, res: Response) => {
  const result = await db.query(
    `SELECT cv.*, u.full_name, u.phone_raw FROM chat_violations cv
     JOIN users u ON u.id = cv.user_id
     ORDER BY cv.detected_at DESC LIMIT 100`
  );
  return res.json(result.rows);
});

export { router as adminRouter };
