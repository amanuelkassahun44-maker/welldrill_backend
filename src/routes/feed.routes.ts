import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { moderatePost } from '../services/content-moderation.service';

const router = Router();

// POST /api/feed/post — Upload a new post (AI moderated)
router.post('/post', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { caption, media_urls, media_type, thumbnail_base64 } = req.body;

    // AI moderation — run before saving
    let moderationResult;
    try {
      moderationResult = await moderatePost({
        imageBase64: thumbnail_base64,
        caption: caption || '',
        mediaType: media_type || 'image',
      });
    } catch (_) {
      moderationResult = { decision: 'approved', confidence: 0.5, rejectionReason: null, categories: {} };
    }

    const isApproved = moderationResult.decision === 'approved';

    const result = await db.query(
      `INSERT INTO posts (author_id, caption, media_urls, media_type, ai_moderation, ai_rejection_reason, is_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user!.id, caption, media_urls, media_type || 'image',
       moderationResult.decision, moderationResult.rejectionReason, isApproved]
    );

    if (!isApproved) {
      return res.status(422).json({
        error: 'Post rejected by AI moderation',
        reason: moderationResult.rejectionReason,
        post: result.rows[0],
      });
    }

    return res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error';
    return res.status(500).json({ error: msg });
  }
});

// GET /api/feed — Get approved posts (TikTok-style paginated feed)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    const result = await db.query(
      `SELECT p.*, u.full_name as author_name, u.avatar_url, u.is_verified,
              false as is_liked
       FROM posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.is_visible = true AND p.ai_moderation = 'approved'
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.json(result.rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error';
    return res.status(500).json({ error: msg });
  }
});

// POST /api/feed/:id/like
router.post('/:id/like', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await db.query('SELECT 1 FROM post_likes WHERE user_id=$1 AND post_id=$2', [req.user!.id, id]);
    if (existing.rows[0]) {
      await db.query('DELETE FROM post_likes WHERE user_id=$1 AND post_id=$2', [req.user!.id, id]);
      await db.query('UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1', [id]);
      return res.json({ liked: false });
    }
    await db.query('INSERT INTO post_likes (user_id, post_id) VALUES ($1,$2)', [req.user!.id, id]);
    await db.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1', [id]);
    return res.json({ liked: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error';
    return res.status(500).json({ error: msg });
  }
});

export { router as feedRouter };
