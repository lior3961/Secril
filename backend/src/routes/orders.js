import express from 'express';
import { supabase, supabaseForToken, supabaseAdmin } from '../supabase.js';
import { sendOrderStatusEmail } from '../lib/mailer.js';
import { requireAuthToken } from '../middleware/authToken.js';
import { logger } from '../lib/logger.js';

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
      return res.status(404).json({ error: 'Order not found.' });
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

  // Validate and create order with atomic stock updates
  try {
    // Validate products_arr
    if (!products_arr || !products_arr.products_ids || products_arr.products_ids.length === 0) {
      logger.warn('Order creation attempted without products', req, { user_id });
      return res.status(400).json({ error: 'לא נבחרו מוצרים' });
    }

    const productIds = products_arr.products_ids;
    const uniqueProductIds = [...new Set(productIds)];

    // Count quantities for each product
    const productCounts = {};
    productIds.forEach(id => {
      productCounts[id] = (productCounts[id] || 0) + 1;
    });

    // Atomic stock update with retry logic (optimized for Vercel free plan timeout)
    const maxRetries = 2; // Reduced to 2 to stay within 10s timeout
    let attempt = 0;
    let stockUpdateSuccess = false;
    let stockErrors = [];

    while (attempt < maxRetries && !stockUpdateSuccess) {
      attempt++;
      stockErrors = [];

      try {
        // Get current stock levels
        const { data: products, error: productsError } = await supabaseAdmin
          .from('products')
          .select('id, name, quantity_in_stock')
          .in('id', uniqueProductIds);

        if (productsError) {
          logger.error('Failed to fetch products for stock check', productsError, req, { user_id, attempt });
          throw new Error('שגיאה בבדיקת מלאי');
        }

        // Validate stock availability
        for (const product of products) {
          const orderedQuantity = productCounts[product.id] || 0;
          
          if (product.quantity_in_stock <= 0) {
            return res.status(400).json({ 
              error: `מוצר "${product.name}" אזל מהמלאי לחלוטין` 
            });
          }
          
          if (product.quantity_in_stock < orderedQuantity) {
            return res.status(400).json({ 
              error: `מוצר "${product.name}" - כמות מבוקשת (${orderedQuantity}) עולה על הכמות במלאי (${product.quantity_in_stock})` 
            });
          }
        }

        // Update stock for each product atomically
        for (const product of products) {
          const orderedQuantity = productCounts[product.id] || 0;
          const newStock = product.quantity_in_stock - orderedQuantity;
          
          logger.debug(`Updating stock for product ${product.id}: ${product.quantity_in_stock} -> ${newStock} (attempt ${attempt})`);
          
          // Use optimistic locking by checking the current stock hasn't changed
          const { data: updated, error: updateError } = await supabaseAdmin
            .from('products')
            .update({ quantity_in_stock: newStock })
            .eq('id', product.id)
            .eq('quantity_in_stock', product.quantity_in_stock) // Optimistic lock
            .select();

          if (updateError) {
            logger.error(`Stock update error for product ${product.id}`, updateError, req, { 
              user_id, 
              productId: product.id, 
              attempt 
            });
            stockErrors.push({ productId: product.id, error: updateError });
            break; // Exit product loop to retry
          }

          // If no rows were updated, stock changed since we checked (race condition)
          if (!updated || updated.length === 0) {
            logger.warn(`Stock changed for product ${product.id}, retrying`, req, { 
              user_id, 
              productId: product.id, 
              attempt 
            });
            stockErrors.push({ productId: product.id, error: 'Stock changed' });
            break; // Exit product loop to retry
          }
        }

        // If no errors, we succeeded
        if (stockErrors.length === 0) {
          stockUpdateSuccess = true;
          logger.info('Stock updated successfully', req, { user_id, attempt });
        } else if (attempt < maxRetries) {
          // Short delay optimized for Vercel's 10s timeout limit
          const delayMs = 500 * attempt; // 500ms, 1000ms
          logger.info(`Retrying stock update in ${delayMs}ms`, req, { user_id, attempt });
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (err) {
        logger.error('Stock update attempt failed', err, req, { user_id, attempt });
        if (attempt >= maxRetries) {
          throw err;
        }
      }
    }

    // If stock update failed after all retries
    if (!stockUpdateSuccess) {
      logger.error('Stock update failed after all retries', null, req, { 
        user_id, 
        attempts: maxRetries,
        errors: stockErrors 
      });
      return res.status(409).json({ 
        error: 'לא ניתן להשלים את ההזמנה כרגע. אנא נסה שנית.',
        retryable: true
      });
    }

    // Create the order
    const { error: orderError } = await s
      .from('orders')
      .insert([{ 
        user_id, 
        address: address ?? null, 
        city: city ?? null,
        postal_code: postal_code ?? null,
        products_arr: products_arr ?? null, 
        price 
      }]);

    if (orderError) {
      logger.error('Order creation failed after stock update', orderError, req, { user_id });
      // Note: Stock was already deducted - admin will need to handle this
      return res.status(400).json({ error: orderError.message });
    }

    logger.info('Order created successfully', req, { user_id, price }); // Success doesn't need DB logging
    res.json({ ok: true });

  } catch (error) {
    logger.error('Order creation error', error, req, { user_id, price });
    res.status(500).json({ error: 'שגיאה בהשלמת ההזמנה' });
  }
});

export default router;

/**
 * PATCH /api/orders/:id/status — update order status (admin only) and notify via email
 * body: { status }
 */
router.patch('/:id/status', requireAuthToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!id) return res.status(400).json({ error: 'order ID is required' });
  if (!status) return res.status(400).json({ error: 'status is required' });

  try {
    const s = supabaseForToken(req.jwt);
    const { data: userData, error: meErr } = await s.auth.getUser();
    if (meErr) return res.status(401).json({ error: meErr.message });
    const user_id = userData.user.id;

    // Simple admin check via profiles.is_admin (adjust to your schema)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user_id)
      .single();

    if (!profile?.is_admin) {
      return res.status(403).json({ error: 'admin_only' });
    }

    // Get existing order
    const { data: order, error: getErr } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, price, status')
      .eq('id', id)
      .single();
    if (getErr || !order) return res.status(404).json({ error: 'Order not found.' });

    // Update status
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (updErr) return res.status(400).json({ error: updErr.message });

    // Notify user (best-effort)
    try {
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', order.user_id)
        .single();
      if (userProfile?.email) {
        await sendOrderStatusEmail({
          toEmail: userProfile.email,
          toName: userProfile.full_name || '',
          order: updated,
          status
        });
      }
    } catch (e) {
      console.error('Failed to send status email:', e);
    }

    res.json({ ok: true, order: updated });
  } catch (error) {
    logger.error('Order status update error', error, req, { id, status });
    res.status(500).json({ error: 'Internal server error' });
  }
});
