import { Router, Response } from 'express';
import { db } from '../config/database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { sendPushNotification } from '../services/notification.service';

const router = Router();

// POST /api/services/request — Client creates a drilling request
router.post('/request', authenticate, requireRole('client'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      title, description, estimated_depth, budget_min, budget_max,
      region_id, zone_id, woreda_id, city_id, custom_location, lat, lng
    } = req.body;

    const result = await db.query(
      `INSERT INTO service_requests
        (client_id, title, description, estimated_depth, budget_min, budget_max,
         region_id, zone_id, woreda_id, city_id, custom_location, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [req.user!.id, title, description, estimated_depth, budget_min, budget_max,
       region_id, zone_id, woreda_id, city_id, custom_location, lat, lng]
    );

    // Notify nearby providers via FCM
    await notifyNearbyProviders(result.rows[0]);

    return res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error';
    return res.status(500).json({ error: msg });
  }
});

// GET /api/services/requests — List open requests (for provider job board)
router.get('/requests', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { region_id, min_budget, max_budget, limit = 20, offset = 0 } = req.query;
    let query = `
      SELECT sr.*, u.full_name as client_name, u.avatar_url as client_avatar,
             r.name_en as region_name
      FROM service_requests sr
      JOIN users u ON u.id = sr.client_id
      LEFT JOIN regions r ON r.id = sr.region_id
      WHERE sr.status = 'open'
    `;
    const params: unknown[] = [];
    let idx = 1;
    if (region_id) { query += ` AND sr.region_id = $${idx++}`; params.push(region_id); }
    if (min_budget) { query += ` AND sr.budget_min >= $${idx++}`; params.push(min_budget); }
    if (max_budget) { query += ` AND sr.budget_max <= $${idx++}`; params.push(max_budget); }
    query += ` ORDER BY sr.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
    const result = await db.query(query, params);
    return res.json(result.rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error';
    return res.status(500).json({ error: msg });
  }
});

// POST /api/services/bid — Provider submits a bid
router.post('/bid', authenticate, requireRole('provider'), async (req: AuthRequest, res: Response) => {
  try {
    const { request_id, bid_amount, mobilization_fee, message } = req.body;

    // Check request is still open
    const reqCheck = await db.query(
      `SELECT id FROM service_requests WHERE id = $1 AND status = 'open'`,
      [request_id]
    );
    if (!reqCheck.rows[0]) return res.status(404).json({ error: 'Request not found or closed' });

    // Check no duplicate bid
    const dupCheck = await db.query(
      `SELECT id FROM bids WHERE request_id = $1 AND provider_id = $2 AND status = 'pending'`,
      [request_id, req.user!.id]
    );
    if (dupCheck.rows[0]) return res.status(409).json({ error: 'Already submitted a bid' });

    const result = await db.query(
      `INSERT INTO bids (request_id, provider_id, bid_amount, mobilization_fee, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request_id, req.user!.id, bid_amount, mobilization_fee, message]
    );

    // Notify client about new bid
    const clientReq = await db.query(
      `SELECT u.fcm_token FROM service_requests sr JOIN users u ON u.id = sr.client_id WHERE sr.id = $1`,
      [request_id]
    );
    if (clientReq.rows[0]?.fcm_token) {
      await sendPushNotification(clientReq.rows[0].fcm_token, {
        title: '📨 New Bid Received!',
        body: `A driller bid ETB ${bid_amount.toLocaleString()} on your request`,
        data: { type: 'new_bid', request_id }
      });
    }

    return res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error';
    return res.status(500).json({ error: msg });
  }
});

// POST /api/services/hire — Client accepts a bid
router.post('/hire', authenticate, requireRole('client'), async (req: AuthRequest, res: Response) => {
  try {
    const { bid_id } = req.body;

    const bidResult = await db.query(
      `SELECT b.*, sr.client_id, sr.id as req_id FROM bids b
       JOIN service_requests sr ON sr.id = b.request_id
       WHERE b.id = $1 AND b.status = 'pending' AND sr.client_id = $2`,
      [bid_id, req.user!.id]
    );
    if (!bidResult.rows[0]) return res.status(404).json({ error: 'Bid not found' });

    const bid = bidResult.rows[0];
    const total = parseFloat(bid.bid_amount) + parseFloat(bid.mobilization_fee || 0);
    const commission = Math.round(total * 0.05 * 100) / 100;
    const providerEarnings = Math.round((total - commission) * 100) / 100;

    // Update bid status
    await db.query(`UPDATE bids SET status = 'accepted' WHERE id = $1`, [bid_id]);
    await db.query(`UPDATE bids SET status = 'rejected' WHERE request_id = $1 AND id != $2`, [bid.req_id, bid_id]);
    await db.query(`UPDATE service_requests SET status = 'hired', hired_provider_id = $1 WHERE id = $2`,
      [bid.provider_id, bid.req_id]);

    // Create order
    const orderResult = await db.query(
      `INSERT INTO orders (request_id, bid_id, client_id, provider_id, total_amount, platform_commission, provider_earnings)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [bid.req_id, bid_id, req.user!.id, bid.provider_id, total, commission, providerEarnings]
    );

    const order = orderResult.rows[0];

    // Create chat room
    const chatRoom = await db.query(
      `INSERT INTO chat_rooms (order_id, participant1, participant2)
       VALUES ($1, $2, $3) RETURNING *`,
      [order.id, req.user!.id, bid.provider_id]
    );

    // Notify provider
    const providerUser = await db.query('SELECT fcm_token FROM users WHERE id = $1', [bid.provider_id]);
    if (providerUser.rows[0]?.fcm_token) {
      await sendPushNotification(providerUser.rows[0].fcm_token, {
        title: '🎉 Your bid was accepted!',
        body: `Job confirmed! ETB ${providerEarnings.toLocaleString()} will be released after payment.`,
        data: { type: 'bid_accepted', order_id: order.id }
      });
    }

    return res.status(201).json({
      order,
      chatRoomId: chatRoom.rows[0].id,
      commissionBreakdown: {
        total: total,
        platform_commission: commission,
        provider_earnings: providerEarnings,
        milestone_1_30pct: Math.round(total * 0.30),
        milestone_2_40pct: Math.round(total * 0.40),
        milestone_3_30pct: Math.round(total * 0.30),
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error';
    return res.status(500).json({ error: msg });
  }
});

async function notifyNearbyProviders(request: Record<string, unknown>) {
  try {
    const providers = await db.query(
      `SELECT u.fcm_token FROM provider_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_available = true AND pp.region_id = $1 AND u.fcm_token IS NOT NULL`,
      [request.region_id]
    );
    for (const p of providers.rows) {
      if (p.fcm_token) {
        await sendPushNotification(p.fcm_token, {
          title: '⛏️ New drilling job near you!',
          body: `Budget: ETB ${request.budget_max?.toLocaleString()} — Check the job board!`,
          data: { type: 'new_request', request_id: request.id as string }
        });
      }
    }
  } catch (e) { console.error('Notify providers error:', e); }
}

export { router as serviceRouter };
