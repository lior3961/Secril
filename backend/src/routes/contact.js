import express from 'express';
import { supabaseAdmin } from '../supabase.js';

const router = express.Router();

/** POST /api/contact — submit contact form */
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('contact_messages')
      .insert([{
        name,
        email,
        message
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: data });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
