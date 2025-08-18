import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabase.js';

export const requireAdminAuth = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Use regular supabase client to get user from token
    const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await s.auth.getUser(token);
    
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Use supabaseAdmin to check admin status (bypasses RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return res.status(401).json({ error: 'User profile not found' });
    }
    
    if (!profile.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
