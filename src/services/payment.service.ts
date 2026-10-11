import axios from 'axios';
import { db } from '../config/database';

const CHAPA_BASE_URL = process.env.CHAPA_BASE_URL || 'https://api.chapa.co/v1';
const CHAPA_SECRET = process.env.CHAPA_SECRET_KEY || '';

interface ChapaInitParams {
  amount: number;
  currency?: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  tx_ref: string;
  callback_url: string;
  return_url: string;
  customization?: { title: string; description: string };
}

export async function initiateChapaPayment(params: ChapaInitParams) {
  const response = await axios.post(`${CHAPA_BASE_URL}/transaction/initialize`, params, {
    headers: { Authorization: `Bearer ${CHAPA_SECRET}`, 'Content-Type': 'application/json' },
  });
  return response.data;
}

export async function verifyChapaPayment(tx_ref: string) {
  const response = await axios.get(`${CHAPA_BASE_URL}/transaction/verify/${tx_ref}`, {
    headers: { Authorization: `Bearer ${CHAPA_SECRET}` },
  });
  return response.data;
}

export async function processCommission(orderId: string, paidAmount: number, milestoneNumber: 1 | 2 | 3) {
  const commission = Math.round(paidAmount * 0.05 * 100) / 100;
  const providerShare = Math.round((paidAmount - commission) * 100) / 100;

  const order = await db.query('SELECT provider_id FROM orders WHERE id = $1', [orderId]);
  if (!order.rows[0]) throw new Error('Order not found');

  // Credit provider wallet (95%)
  await db.query(
    `UPDATE provider_profiles SET wallet_balance = wallet_balance + $1 WHERE user_id = $2`,
    [providerShare, order.rows[0].provider_id]
  );

  // Update order payment status
  const statusMap = { 1: 'advance_paid', 2: 'mid_paid', 3: 'completed' };
  await db.query(
    `UPDATE orders SET payment_status = $1, advance_paid = advance_paid + $2 WHERE id = $3`,
    [statusMap[milestoneNumber], paidAmount, orderId]
  );

  return { commission, providerShare, milestoneNumber };
}
