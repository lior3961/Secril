import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabase.js';

const router = express.Router();

const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

/**
 * Signup
 * body: { email, password, full_name?, date_of_birth? }
 * If SERVICE_ROLE is set, we create the user as confirmed immediately.
 * Otherwise, signUp with anon will send a confirmation email.
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, full_name, date_of_birth, phone } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    let userId;
    if (process.env.SUPABASE_SERVICE_ROLE) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, date_of_birth, phone },
      });
      if (error) return res.status(400).json({ error: error.message });
      userId = data.user.id;
    } else {
      const { data, error } = await supabaseAnon.auth.signUp({
        email,
        password,
        options: { data: { full_name, date_of_birth, phone } },
      });
      if (error) return res.status(400).json({ error: error.message });
      userId = data.user?.id;
    }

    // Upsert profile (RLS bypass via service role)
    if (userId) {
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        full_name: full_name ?? null,
        date_of_birth: date_of_birth ?? null,
        phone: phone ?? null,
      });
    }

    res.json({ ok: true, user_id: userId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Login
 * body: { email, password }
 * Returns { user, session: { access_token, refresh_token, expires_at } }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    res.json({
      ok: true,
      user: data.user,
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Logout
 * body: { access_token, refresh_token }
 * (Server is stateless; client can also just forget tokens.)
 */
router.post('/logout', async (req, res) => {
  try {
    const { access_token, refresh_token } = req.body || {};
    if (!access_token || !refresh_token) return res.json({ ok: true });

    const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    await s.auth.setSession({ access_token, refresh_token });
    await s.auth.signOut();

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
