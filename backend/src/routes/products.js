import express from 'express';
import { supabase, supabaseAdmin } from '../supabase.js';

const router = express.Router();

/** GET /api/products — public list */
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, price, quantity_in_stock, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ products: data || [] });
});

/** POST /api/products — admin create (requires service role set) */
router.post('/', async (req, res) => {
  if (!process.env.SUPABASE_SERVICE_ROLE) {
    return res.status(403).json({ error: 'admin endpoint requires SERVICE_ROLE on server' });
  }
  const { name, description, price, quantity_in_stock = 0 } = req.body || {};
  if (!name || price == null) return res.status(400).json({ error: 'name and price are required' });

  const { error } = await supabaseAdmin.from('products').insert([
    { name, description: description ?? null, price, quantity_in_stock },
  ]);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
