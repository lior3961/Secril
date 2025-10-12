import express from 'express';
import authRoutes from './auth.js';
import productsRoutes from './products.js';
import ordersRoutes from './orders.js';
import adminRoutes from './admin.js';
import contactRoutes from './contact.js';
import paymentsRoutes from './payments.js';

const router = express.Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    urlSet: !!process.env.SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE,
    cardcomConfigured: !!(process.env.CARDCOM_TERMINAL_NUMBER && process.env.CARDCOM_API_NAME),
  });
});

// Routes
router.use('/auth', authRoutes);
router.use('/products', productsRoutes);
router.use('/orders', ordersRoutes);
router.use('/admin', adminRoutes);
router.use('/contact', contactRoutes);
router.use('/payments', paymentsRoutes);

export default router;
