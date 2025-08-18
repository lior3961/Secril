import express from 'express';
import { supabaseForToken } from '../supabase.js';
import { requireAuthToken } from '../middleware/authToken.js';

const router = express.Router();

/** GET /api/orders — list current user’s orders (JWT required) */
router.get('/', requireAuthToken, async (req, res) => {
  const s = supabaseForToken(req.jwt);
  const { data, error } = await s
    .from('orders')
    .select('id, created_at, address, products_arr, status, price')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ orders: data || [] });
});

/** POST /api/orders — place an order for current user (JWT required)
 * body: { address, products_arr, price }
 * products_arr: array/object with product ids/quantities (keep simple for now)
 */
router.post('/', requireAuthToken, async (req, res) => {
  const { address, products_arr, price } = req.body || {};
  if (price == null) return res.status(400).json({ error: 'price is required' });

  const s = supabaseForToken(req.jwt);

  // We must set user_id on the server; RLS will check user_id = auth.uid()
  // We can fetch user from the token via auth.getUser(), but insert allows user_id = auth.uid() via check.
  // Simpler: rely on RLS WITH CHECK (user_id = auth.uid()) and set it via a rpc or directly:
  const { data: userData, error: meErr } = await s.auth.getUser();
  if (meErr) return res.status(401).json({ error: meErr.message });
  const user_id = userData.user.id;

  const { error } = await s
    .from('orders')
    .insert([{ user_id, address: address ?? null, products_arr: products_arr ?? null, price }]);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
