import express from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { logger } from '../lib/logger.js';

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
      .select('id, full_name, phone');
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
          full_name: profile?.full_name || null,
          phone: profile?.phone || authUser?.phone || null
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

/** POST /api/admin/feedbacks/upload-image — upload feedback image */
router.post('/feedbacks/upload-image', requireAdminAuth, async (req, res) => {
  try {
    const { imageData, fileName } = req.body || {};
    
    if (!imageData || !fileName) {
      return res.status(400).json({ error: 'imageData and fileName are required' });
    }
    
    // Validate base64 data
    if (!imageData.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image data format' });
    }
    
    // Check file size (max 5MB for feedback images)
    const base64Data = imageData.split(',')[1];
    const fileSizeInBytes = Math.ceil((base64Data.length * 3) / 4);
    const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
    
    if (fileSizeInBytes > maxSizeInBytes) {
      return res.status(413).json({ error: 'Image file too large. Maximum size is 5MB.' });
    }
    
    // Upload to feedbacks bucket
    const { data, error } = await supabaseAdmin.storage
      .from('feedbacks')
      .upload(fileName, Buffer.from(base64Data, 'base64'), {
        contentType: 'image/jpeg',
        upsert: false
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      return res.status(500).json({ error: 'Failed to upload image: ' + error.message });
    }
    
    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('feedbacks')
      .getPublicUrl(fileName);
    
    res.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error('Feedback image upload error:', error);
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

/** POST /api/admin/users/:id/make-admin — promote user to admin (admin only) */
router.post('/users/:id/make-admin', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { access } = getTokens();
    
    // Update user to admin
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', id);
    
    if (error) return res.status(400).json({ error: error.message });
    
    // Log admin action
    await supabaseAdmin
      .from('admin_audit_log')
      .insert({
        admin_id: req.adminUser.id,
        action: 'promote_to_admin',
        target_user_id: id,
        details: 'User promoted to admin'
      });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Make admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/admin/users/:id/remove-admin — remove admin privileges (admin only) */
router.post('/users/:id/remove-admin', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent removing yourself as admin
    if (id === req.adminUser.id) {
      return res.status(400).json({ error: 'Cannot remove your own admin privileges' });
    }
    
    // Update user to remove admin
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_admin: false })
      .eq('id', id);
    
    if (error) return res.status(400).json({ error: error.message });
    
    // Log admin action
    await supabaseAdmin
      .from('admin_audit_log')
      .insert({
        admin_id: req.adminUser.id,
        action: 'remove_admin',
        target_user_id: id,
        details: 'User admin privileges removed'
      });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Remove admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/admin/error-logs — get error logs with filters (admin only) */
router.get('/error-logs', requireAdminAuth, async (req, res) => {
  try {
    const { 
      level, 
      limit = 100, 
      offset = 0,
      startDate,
      endDate,
      searchTerm,
      userId,
      requestPath
    } = req.query;

    // Build query
    let query = supabaseAdmin
      .from('error_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (level && level !== 'all') {
      query = query.eq('level', level);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (requestPath) {
      query = query.ilike('request_path', `%${requestPath}%`);
    }

    if (searchTerm) {
      query = query.or(`message.ilike.%${searchTerm}%,stack_trace.ilike.%${searchTerm}%`);
    }

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch error logs', error, req);
      return res.status(400).json({ error: error.message });
    }

    res.json({ 
      logs: data || [], 
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('Error logs fetch error', error, req);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/admin/error-logs/:id — get specific error log (admin only) */
router.get('/error-logs/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('error_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Error log not found' });
      }
      logger.error('Failed to fetch error log', error, req, { logId: id });
      return res.status(400).json({ error: error.message });
    }

    res.json({ log: data });

  } catch (error) {
    logger.error('Error log fetch error', error, req);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/admin/error-logs/stats/summary — get error statistics (admin only) */
router.get('/error-logs/stats/summary', requireAdminAuth, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get counts by level
    const { data: levelStats, error: levelError } = await supabaseAdmin
      .from('error_logs')
      .select('level')
      .gte('created_at', startDate.toISOString());

    if (levelError) {
      logger.error('Failed to fetch error level stats', levelError, req);
      return res.status(400).json({ error: levelError.message });
    }

    // Count by level
    const levelCounts = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0
    };

    levelStats.forEach(log => {
      if (levelCounts[log.level] !== undefined) {
        levelCounts[log.level]++;
      }
    });

    // Get most common error paths
    const { data: pathStats, error: pathError } = await supabaseAdmin
      .from('error_logs')
      .select('request_path')
      .eq('level', 'error')
      .gte('created_at', startDate.toISOString())
      .not('request_path', 'is', null);

    if (pathError) {
      logger.error('Failed to fetch error path stats', pathError, req);
    }

    // Count by path
    const pathCounts = {};
    if (pathStats) {
      pathStats.forEach(log => {
        pathCounts[log.request_path] = (pathCounts[log.request_path] || 0) + 1;
      });
    }

    // Sort and get top 10
    const topPaths = Object.entries(pathCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    res.json({
      period: `Last ${days} days`,
      levelCounts,
      topErrorPaths: topPaths,
      total: levelStats.length
    });

  } catch (error) {
    logger.error('Error stats fetch error', error, req);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /api/admin/error-logs/cleanup — cleanup old error logs (admin only) */
router.delete('/error-logs/cleanup', requireAdminAuth, async (req, res) => {
  try {
    const { days = 30 } = req.body;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const { error, count } = await supabaseAdmin
      .from('error_logs')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      logger.error('Failed to cleanup error logs', error, req);
      return res.status(400).json({ error: error.message });
    }

    logger.info(`Cleaned up ${count} error logs older than ${days} days`, req, { 
      deletedCount: count, 
      days 
    }); // Success doesn't need DB logging

    res.json({ 
      ok: true, 
      deletedCount: count,
      message: `Deleted ${count} logs older than ${days} days` 
    });

  } catch (error) {
    logger.error('Error logs cleanup error', error, req);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
