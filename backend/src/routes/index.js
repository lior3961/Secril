import express from 'express';
import authRoutes from './auth.js';
import productsRoutes from './products.js';
import ordersRoutes from './orders.js';
import adminRoutes from './admin.js';
import contactRoutes from './contact.js';

const router = express.Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    urlSet: !!process.env.SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE,
  });
});

// Routes
router.use('/auth', authRoutes);
router.use('/products', productsRoutes);
router.use('/orders', ordersRoutes);
router.use('/admin', adminRoutes);
router.use('/contact', contactRoutes);

export default router;
