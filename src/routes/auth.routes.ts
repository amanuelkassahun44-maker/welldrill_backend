import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { auth } from '../config/firebase';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// POST /api/auth/register — Called after Firebase Auth on mobile
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { firebase_token, role, full_name, phone } = req.body;
    if (!firebase_token || !role || !full_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify Firebase token
    const decoded = await auth.verifyIdToken(firebase_token);

    // Check if user already exists
    const existing = await db.query(
      'SELECT id FROM users WHERE firebase_uid = $1', [decoded.uid]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'User already exists', id: existing.rows[0].id });
    }

    // Mask phone number for public display
    const phoneMasked = phone
      ? phone.replace(/(\d{3})(\d{3})(\d+)/, '$1-***-$3')
      : null;

    const result = await db.query(
      `INSERT INTO users (firebase_uid, role, full_name, email, phone_raw, phone_masked)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, role, full_name, is_verified`,
      [decoded.uid, role, full_name, decoded.email || null, phone || null, phoneMasked]
    );

    const user = result.rows[0];

    // If provider, create empty provider profile
    if (role === 'provider') {
      await db.query(
        'INSERT INTO provider_profiles (user_id) VALUES ($1)',
        [user.id]
      );
    }

    return res.status(201).json({ message: 'Registered successfully', user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
});

// GET /api/auth/me — Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.role, u.full_name, u.email, u.phone_masked, u.avatar_url,
              u.is_verified, u.preferred_lang, u.created_at,
              pp.business_name, pp.rig_types, pp.star_rating, pp.wallet_balance,
              pp.is_available
       FROM users u
       LEFT JOIN provider_profiles pp ON pp.user_id = u.id
       WHERE u.id = $1`,
      [req.user!.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/auth/fcm-token — Update push token
router.put('/fcm-token', authenticate, async (req: AuthRequest, res: Response) => {
  const { fcm_token } = req.body;
  await db.query('UPDATE users SET fcm_token = $1 WHERE id = $2', [fcm_token, req.user!.id]);
  return res.json({ success: true });
});

export { router as authRouter };
