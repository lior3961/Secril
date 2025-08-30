import express from 'express';
import { supabase, supabaseForToken, supabaseAdmin } from '../supabase.js';
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

  // Start a transaction to update stock quantities
  try {
    // First, check if all products have sufficient stock
    if (products_arr && products_arr.products_ids) {
      const productIds = products_arr.products_ids;
      const { data: products, error: productsError } = await s
        .from('products')
        .select('id, name, quantity_in_stock')
        .in('id', [...new Set(productIds)]); // Get unique product IDs

      if (productsError) return res.status(400).json({ error: productsError.message });

      // Count quantities for each product
      const productCounts = {};
      productIds.forEach(id => {
        productCounts[id] = (productCounts[id] || 0) + 1;
      });

      // Check stock availability
      for (const product of products) {
        const orderedQuantity = productCounts[product.id] || 0;
        if (product.quantity_in_stock < orderedQuantity) {
          return res.status(400).json({ 
            error: `מוצר "${product.name}" אזל מהמלאי. במלאי: ${product.quantity_in_stock}, מבוקש: ${orderedQuantity}` 
          });
        }
      }

             // Update stock quantities using admin client to bypass RLS
       for (const product of products) {
         const orderedQuantity = productCounts[product.id] || 0;
         const newStock = product.quantity_in_stock - orderedQuantity;
         
         console.log(`Updating product ${product.id} (${product.name}): ${product.quantity_in_stock} -> ${newStock} (ordered: ${orderedQuantity})`);
         
         const { error: updateError } = await supabaseAdmin
           .from('products')
           .update({ quantity_in_stock: newStock })
           .eq('id', product.id);

         if (updateError) {
           console.error('Stock update error for product', product.id, updateError);
           return res.status(400).json({ error: 'שגיאה בעדכון המלאי' });
         }
       }
    }

    // Create the order
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

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'שגיאה בהשלמת ההזמנה' });
  }
});

export default router;
