import express from 'express';
import { supabase, supabaseAdmin } from '../supabase.js';
import { logger } from '../lib/logger.js';

const router = express.Router();

/** GET /api/products — public list */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price, quantity_in_stock, image_url, feedbacks, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch products', error, req);
      return res.status(400).json({ error: error.message });
    }
    
    res.json({ products: data || [] });
  } catch (error) {
    logger.error('Products fetch error', error, req);
    res.status(500).json({ error: 'Internal server error' });
  }
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
