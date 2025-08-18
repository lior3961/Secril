import express from 'express';
import { supabase, supabaseForToken } from '../supabase.js';
import { requireAuthToken } from '../middleware/authToken.js';

const router = express.Router();

/** GET /api/orders — list current user’s orders (JWT required) */
router.get('/', requireAuthToken, async (req, res) => {
  const s = supabaseForToken(req.jwt);
  const { data, error } = await s
    .from('orders')
    .select('id, created_at, address, city, postal_code, products_arr, status, price')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  
  // Process orders to include product details
  const processedOrders = await Promise.all((data || []).map(async (order) => {
    if (order.products_arr && order.products_arr.products_ids) {
      // Get product details for each product ID
      const productIds = order.products_arr.products_ids;
      const { data: products, error: productsError } = await s
        .from('products')
        .select('id, name, price, image_url')
        .in('id', productIds);
      
      if (!productsError && products) {
        // Count quantities for each product
        const productCounts = {};
        productIds.forEach(id => {
          productCounts[id] = (productCounts[id] || 0) + 1;
        });
        
        // Create products array with quantities
        const productsWithQuantities = products.map(product => ({
          ...product,
          quantity: productCounts[product.id]
        }));
        
        return {
          ...order,
          products_arr: productsWithQuantities
        };
      }
    }
    return order;
  }));
  
  res.json({ orders: processedOrders });
});

/** GET /api/orders/:id — get order by ID (public, no auth required) */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'order ID is required' });

  const { data, error } = await supabase
    .from('orders')
    .select('id, created_at, address, city, postal_code, products_arr, status, price')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.status(400).json({ error: error.message });
  }
  
  // Process order to include product details
  let processedOrder = data;
  if (data.products_arr && data.products_arr.products_ids) {
    const productIds = data.products_arr.products_ids;
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, image_url')
      .in('id', productIds);
    
    if (!productsError && products) {
      // Count quantities for each product
      const productCounts = {};
      productIds.forEach(id => {
        productCounts[id] = (productCounts[id] || 0) + 1;
      });
      
      // Create products array with quantities
      const productsWithQuantities = products.map(product => ({
        ...product,
        quantity: productCounts[product.id]
      }));
      
      processedOrder = {
        ...data,
        products_arr: productsWithQuantities
      };
    }
  }
  
  res.json({ order: processedOrder });
});

/** POST /api/orders — place an order for current user (JWT required)
 * body: { address, products_arr, price }
 * products_arr: array/object with product ids/quantities (keep simple for now)
 */
router.post('/', requireAuthToken, async (req, res) => {
  const { address, products_arr, price, city, postal_code } = req.body || {};
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
    .insert([{ 
      user_id, 
      address: address ?? null, 
      city: city ?? null,
      postal_code: postal_code ?? null,
      products_arr: products_arr ?? null, 
      price 
    }]);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
