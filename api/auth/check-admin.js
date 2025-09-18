import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.query.access_token;
    
    if (!token) {
      return res.status(401).json({ isAdmin: false, error: 'Token required' });
    }

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ isAdmin: false, error: 'Invalid token' });
    }

    console.log('Checking admin status for user:', user.id);
    
    // Check if user is admin
    const { data: adminCheck, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ isAdmin: false, error: 'Failed to check admin status' });
    }

    const isAdmin = adminCheck?.is_admin || false;
    console.log('Admin status:', isAdmin);
    
    res.status(200).json({ isAdmin });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ isAdmin: false, error: 'Internal server error' });
  }
}
