import express from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

// Apply admin auth to all routes
router.use(requireAdminAuth);

/** GET /api/admin/users — get all users */
router.get('/users', async (req, res) => {
  try {
    // Get profiles data
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, date_of_birth, is_admin, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) return res.status(400).json({ error: profilesError.message });

    // Get auth users data to get emails
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) return res.status(400).json({ error: authError.message });

    // Combine profiles with auth users data
    const users = profiles.map(profile => {
      const authUser = authUsers.users.find(u => u.id === profile.id);
      return {
        ...profile,
        email: authUser?.email || null
      };
    });

    res.json({ users: users || [] });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/admin/users/:id — get specific user with orders */
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user profile
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, date_of_birth, is_admin, created_at')
      .eq('id', id)
      .single();

    if (userError) return res.status(400).json({ error: userError.message });

    // Get user's email from auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);
    if (authError) return res.status(400).json({ error: authError.message });

    // Combine profile with email
    const userWithEmail = {
      ...user,
      email: authUser.user?.email || null
    };

    // Get user's orders
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id, created_at, address, city, postal_code, products_arr, status, price')
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    if (ordersError) return res.status(400).json({ error: ordersError.message });

    // Process orders to include product details
    const processedOrders = await Promise.all((orders || []).map(async (order) => {
      if (order.products_arr && order.products_arr.products_ids) {
        const productIds = order.products_arr.products_ids;
        const { data: products, error: productsError } = await supabaseAdmin
          .from('products')
          .select('id, name, price, image_url')
          .in('id', productIds);
        
        if (!productsError && products) {
          const productCounts = {};
          productIds.forEach(id => {
            productCounts[id] = (productCounts[id] || 0) + 1;
          });
          
          const productsWithQuantities = products.map(product => ({
            ...product,
            quantity: productCounts[product.id]
          }));
          
          return { ...order, products_arr: productsWithQuantities };
        }
      }
      return order;
    }));

    res.json({ user: userWithEmail, orders: processedOrders });
  } catch (error) {
    console.error('Admin user details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/admin/orders — get all orders with filters */
router.get('/orders', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = supabaseAdmin
      .from('orders')
      .select(`
        id, created_at, address, city, postal_code, products_arr, status, price, user_id
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) return res.status(400).json({ error: error.message });

    // Get all auth users and profiles to add user info to orders
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) return res.status(400).json({ error: authError.message });

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name');
    if (profilesError) return res.status(400).json({ error: profilesError.message });

    // Add user info to orders
    const ordersWithUserInfo = data.map(order => {
      const authUser = authUsers.users.find(u => u.id === order.user_id);
      const profile = profiles.find(p => p.id === order.user_id);
      return {
        ...order,
        user: {
          id: order.user_id,
          email: authUser?.email || null,
          full_name: profile?.full_name || null
        }
      };
    });

    // Process orders to include product details
    const processedOrders = await Promise.all((ordersWithUserInfo || []).map(async (order) => {
      if (order.products_arr && order.products_arr.products_ids) {
        const productIds = order.products_arr.products_ids;
        const { data: products, error: productsError } = await supabaseAdmin
          .from('products')
          .select('id, name, price, image_url')
          .in('id', productIds);
        
        if (!productsError && products) {
          const productCounts = {};
          productIds.forEach(id => {
            productCounts[id] = (productCounts[id] || 0) + 1;
          });
          
          const productsWithQuantities = products.map(product => ({
            ...product,
            quantity: productCounts[product.id]
          }));
          
          return { ...order, products_arr: productsWithQuantities };
        }
      }
      return order;
    }));

    res.json({ orders: processedOrders });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PATCH /api/admin/orders/:id/status — update order status */
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: 'Status is required' });

    const { error } = await supabaseAdmin
      .from('orders')
      .update({ status })
      .eq('id', id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (error) {
    console.error('Admin update order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/admin/products — create product */
router.post('/products', async (req, res) => {
  try {
    const { name, description, price, quantity_in_stock, image_url } = req.body;
    
    if (!name || price == null) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([{
        name,
        description: description || null,
        price,
        quantity_in_stock: quantity_in_stock || 0,
        image_url: image_url || null,
        feedbacks: { feedbacks: [] }
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ product: data });
  } catch (error) {
    console.error('Admin create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /api/admin/products/:id — update product */
router.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, quantity_in_stock, image_url } = req.body;
    
    if (!name || price == null) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .update({
        name,
        description: description || null,
        price,
        quantity_in_stock: quantity_in_stock || 0,
        image_url: image_url || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ product: data });
  } catch (error) {
    console.error('Admin update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /api/admin/products/:id/feedbacks — update product feedbacks */
router.put('/products/:id/feedbacks', async (req, res) => {
  try {
    const { id } = req.params;
    const { feedbacks } = req.body;
    
    if (!feedbacks) {
      return res.status(400).json({ error: 'Feedbacks data is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ feedbacks })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ product: data });
  } catch (error) {
    console.error('Admin update product feedbacks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /api/admin/products/:id — delete product */
router.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (error) {
    console.error('Admin delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/admin/products/upload-image — upload product image */
router.post('/products/upload-image', async (req, res) => {
  try {
    const { imageData, fileName } = req.body;
    
    if (!imageData || !fileName) {
      return res.status(400).json({ error: 'Image data and filename are required' });
    }

    console.log('Uploading file:', fileName);
    console.log('Image data length:', imageData.length);

    // Validate base64 data
    if (!imageData.includes(',')) {
      return res.status(400).json({ error: 'Invalid image data format' });
    }

    // Convert base64 to buffer
    let buffer;
    try {
      buffer = Buffer.from(imageData.split(',')[1], 'base64');
    } catch (bufferError) {
      console.error('Buffer conversion error:', bufferError);
      return res.status(400).json({ error: 'Invalid image data encoding' });
    }
    
    console.log('Buffer size:', buffer.length, 'bytes');
    
    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      return res.status(413).json({ 
        error: 'Image file too large. Maximum size is 10MB.',
        size: buffer.length,
        maxSize: maxSize
      });
    }
    
    // Determine content type from file extension
    const getContentType = (filename) => {
      const ext = filename.toLowerCase().split('.').pop();
      const contentTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
      };
      return contentTypes[ext] || 'image/jpeg';
    };
    
    const contentType = getContentType(fileName);
    console.log('Content type:', contentType);
    
    // Try to upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('products_images')
      .upload(fileName, buffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error('Storage upload error:', error);
      console.error('Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        details: error.details
      });
      
      // If it's a permission error, provide helpful message
      if (error.message.includes('permission') || error.message.includes('403')) {
        return res.status(403).json({ 
          error: 'Storage permission denied. Please check bucket permissions in Supabase Dashboard.',
          details: error.message 
        });
      }
      
      return res.status(400).json({ error: error.message });
    }

    console.log('Upload successful:', data);

    // Get public URL (since bucket is now public)
    const { data: urlData } = supabaseAdmin.storage
      .from('products_images')
      .getPublicUrl(fileName);

    res.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error('Admin upload image error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

/** GET /api/admin/messages — get contact form messages */
router.get('/messages', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = supabaseAdmin
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) return res.status(400).json({ error: error.message });
    res.json({ messages: data || [] });
  } catch (error) {
    console.error('Admin messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PATCH /api/admin/messages/:id/status — update message status */
router.patch('/messages/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: 'Status is required' });

    const { error } = await supabaseAdmin
      .from('contact_messages')
      .update({ status })
      .eq('id', id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (error) {
    console.error('Admin update message status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
