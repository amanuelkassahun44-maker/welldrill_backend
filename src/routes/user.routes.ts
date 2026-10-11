import { Router, Response } from 'express';
import { db } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.get('/providers', authenticate, async (req: AuthRequest, res: Response) => {
  const { region_id, rig_type, min_rating, limit = 20, offset = 0 } = req.query;
  let query = `SELECT u.id, u.full_name, u.avatar_url, u.is_verified, pp.business_name, pp.rig_types, pp.max_depth_meters, pp.star_rating, pp.total_reviews, pp.is_available, r.name_en as region FROM provider_profiles pp JOIN users u ON u.id = pp.user_id LEFT JOIN regions r ON r.id = pp.region_id WHERE pp.is_available = true AND u.is_active = true`;
  const params: unknown[] = [];
  let idx = 1;
  if (region_id) { query += ` AND pp.region_id = $${idx++}`; params.push(region_id); }
  if (min_rating) { query += ` AND pp.star_rating >= $${idx++}`; params.push(min_rating); }
  query += ` ORDER BY pp.star_rating DESC, u.is_verified DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);
  const result = await db.query(query, params);
  return res.json(result.rows);
});

router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const { full_name, preferred_lang, avatar_url } = req.body;
  const result = await db.query(
    'UPDATE users SET full_name = COALESCE($1, full_name), preferred_lang = COALESCE($2, preferred_lang), avatar_url = COALESCE($3, avatar_url), updated_at = NOW() WHERE id = $4 RETURNING *',
    [full_name, preferred_lang, avatar_url, req.user!.id]
  );
  return res.json(result.rows[0]);
});

router.get('/locations', async (_req, res: Response) => {
  const regions = await db.query('SELECT * FROM regions ORDER BY name_en');
  return res.json(regions.rows);
});

router.get('/locations/:regionId/zones', async (req, res: Response) => {
  const result = await db.query('SELECT * FROM zones WHERE region_id = $1 ORDER BY name_en', [req.params.regionId]);
  return res.json(result.rows);
});

router.get('/locations/:zoneId/woredas', async (req, res: Response) => {
  const result = await db.query('SELECT * FROM woredas WHERE zone_id = $1 ORDER BY name_en', [req.params.zoneId]);
  return res.json(result.rows);
});

export { router as userRouter };
