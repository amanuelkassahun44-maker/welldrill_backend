import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { initiateChapaPayment, verifyChapaPayment, processCommission } from '../services/payment.service';
import { db } from '../config/database';

const router = Router();

// POST /api/payments/initiate — Client initiates payment
router.post('/initiate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { order_id, milestone } = req.body; // milestone: 1, 2, or 3
    const order = await db.query(
      `SELECT o.*, u.email, u.full_name, u.phone_raw
       FROM orders o JOIN users u ON u.id = o.client_id WHERE o.id = $1 AND o.client_id = $2`,
      [order_id, req.user!.id]
    );
    if (!order.rows[0]) return res.status(404).json({ error: 'Order not found' });

    const o = order.rows[0];
    const milestoneAmounts = [0.30, 0.40, 0.30];
    const amount = Math.round(o.total_amount * milestoneAmounts[milestone - 1]);
    const tx_ref = `WD-${order_id.slice(0, 8)}-M${milestone}-${uuidv4().slice(0, 6)}`;
    const nameParts = (o.full_name || 'Customer').split(' ');

    const chapaResult = await initiateChapaPayment({
      amount,
      currency: 'ETB',
      email: o.email || 'customer@welldrill.et',
      first_name: nameParts[0] || 'Customer',
      last_name: nameParts[1] || 'User',
      phone_number: o.phone_raw || '0900000000',
      tx_ref,
      callback_url: `${process.env.BACKEND_URL || 'https://welldrill-api.onrender.com'}/api/payments/webhook`,
      return_url: `${process.env.FRONTEND_URL || 'https://welldrill.et'}/payment-success`,
      customization: { title: 'WellDrill Ethiopia', description: `Milestone ${milestone} Payment` },
    });

    // Store tx_ref in order
    await db.query('UPDATE orders SET chapa_tx_id = $1 WHERE id = $2', [tx_ref, order_id]);

    return res.json({ checkout_url: chapaResult.data?.checkout_url, tx_ref });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Payment error';
    return res.status(500).json({ error: msg });
  }
});

// POST /api/payments/webhook — Chapa webhook callback
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { tx_ref, status } = req.body;
    if (status !== 'success') return res.json({ received: true });

    const verification = await verifyChapaPayment(tx_ref);
    if (verification.status !== 'success') return res.json({ received: true });

    // Parse order_id and milestone from tx_ref: WD-{orderId}-M{n}-{random}
    const parts = tx_ref.split('-');
    const milestoneStr = parts.find((p: string) => p.startsWith('M'));
    const milestone = milestoneStr ? parseInt(milestoneStr.replace('M', '')) : 1;

    const order = await db.query('SELECT id, total_amount FROM orders WHERE chapa_tx_id = $1', [tx_ref]);
    if (!order.rows[0]) return res.json({ received: true });

    const paidAmount = verification.data?.amount || 0;
    await processCommission(order.rows[0].id, paidAmount, milestone as 1 | 2 | 3);

    console.log(`✅ Payment processed: ${tx_ref} | ETB ${paidAmount} | Milestone ${milestone}`);
    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export { router as paymentRouter };
