import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabase.js';
import { loginRateLimiter, signupRateLimiter, devLoginRateLimiter, devSignupRateLimiter, clearRateLimits, getRateLimitStatus } from '../middleware/rateLimiter.js';

const router = express.Router();

const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Input validation functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // Customizable password validation
  const minLength = 6; // Minimum password length
  const requireUppercase = false; // Require uppercase letters
  const requireLowercase = false; // Require lowercase letters  
  const requireNumbers = false; // Require numbers
  const requireSpecialChars = false; // Require special characters
  
  // Basic length check
  if (password.length < minLength) {
    return false;
  }
  
  // Build regex based on requirements
  let regex = '^';
  if (requireUppercase) regex += '(?=.*[A-Z])';
  if (requireLowercase) regex += '(?=.*[a-z])';
  if (requireNumbers) regex += '(?=.*\\d)';
  if (requireSpecialChars) regex += '(?=.*[@$!%*?&])';
  
  // Allow alphanumeric and basic special chars
  regex += '[a-zA-Z\\d@$!%*?&]{' + minLength + ',}$';
  
  const passwordRegex = new RegExp(regex);
  return passwordRegex.test(password);
};

const validatePhone = (phone) => {
  // Israeli phone number format
  const phoneRegex = /^(\+972|0)?[5][0-9]{8}$/;
  return phoneRegex.test(phone);
};

/**
 * Signup with enhanced validation
 * body: { email, password, full_name?, date_of_birth?, phone? }
 */
router.post('/signup', devSignupRateLimiter, async (req, res) => {
  try {
    const { email, password, full_name, date_of_birth, phone } = req.body || {};
    
    // Enhanced validation
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (!validatePassword(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }
    
    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    
    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser.users.some(user => user.email === email);
    
    if (userExists) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

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

    // Create profile (no hardcoded admin emails - use database management)
    if (userId) {
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        full_name: full_name ?? null,
        date_of_birth: date_of_birth ?? null,
        phone: phone ?? null,
        is_admin: false, // Default to false, manage via admin panel
      });
    }

    // Auto-login the user after successful registration
    if (userId && process.env.SUPABASE_SERVICE_ROLE) {
      // If using admin client, we need to sign in with the user's credentials
      const { data: loginData, error: loginError } = await supabaseAnon.auth.signInWithPassword({
        email,
        password
      });

      if (loginError) {
        console.error('Auto-login failed:', loginError);
        return res.json({ 
          ok: true, 
          user_id: userId,
          message: 'Registration successful, please log in manually'
        });
      }

      // Return user data and session tokens for auto-login
      return res.json({
        ok: true,
        user: loginData.user,
        session: {
          access_token: loginData.session?.access_token,
          refresh_token: loginData.session?.refresh_token,
          expires_at: loginData.session?.expires_at,
        },
        message: 'Registration successful and logged in automatically'
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
router.post('/login', devLoginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) {
      // Handle specific error types
      if (error.message.includes('rate limit') || error.message.includes('too many')) {
        return res.status(429).json({ 
          error: 'יותר מדי ניסיונות התחברות, אנא המתן מספר דקות',
          retryAfter: 300 // 5 minutes
        });
      }
      return res.status(400).json({ error: error.message });
    }

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
 * Get current user profile
 * Returns user profile with admin status
 */
router.get('/me', async (req, res) => {
  try {
    const { access_token } = req.query || {};
    if (!access_token) return res.status(401).json({ error: 'No access token provided' });

    console.log('Getting user with token:', access_token.substring(0, 20) + '...');

    const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error } = await s.auth.getUser(access_token);
    
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });

    console.log('Auth user found:', user.id);

    // Get user profile from profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, date_of_birth, is_admin, created_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      console.error('User ID:', user.id);
      return res.status(500).json({ error: 'Failed to fetch profile: ' + profileError.message });
    }

    console.log('Profile found:', profile);

    res.json({ 
      user: {
        id: user.id,
        email: user.email,
        ...profile
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Check if current user is admin
 * Returns { isAdmin: boolean }
 */
router.get('/check-admin', async (req, res) => {
  try {
    const { access_token } = req.query || {};
    if (!access_token) return res.status(401).json({ error: 'No access token provided' });

    const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error } = await s.auth.getUser(access_token);
    
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });

    // Get user profile to check admin status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    res.json({ isAdmin: profile?.is_admin || false });
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

/**
 * Debug endpoint for rate limiting (development only)
 * GET /api/auth/debug-rate-limits?ip=your_ip
 */
router.get('/debug-rate-limits', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { ip } = req.query;
    if (!ip) {
      return res.status(400).json({ error: 'IP parameter required' });
    }

    const status = getRateLimitStatus(ip);
    res.json({
      ip,
      rateLimitStatus: status,
      message: status ? 'Rate limit data found' : 'No rate limit data for this IP'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Clear rate limits (development only)
 * POST /api/auth/clear-rate-limits
 */
router.post('/clear-rate-limits', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    clearRateLimits();
    res.json({ 
      ok: true, 
      message: 'Rate limits cleared for development' 
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
