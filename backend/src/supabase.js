import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE;

// Regular client (RLS enforced unless a JWT is provided)
export const supabase = createClient(url, anon);

// Admin client (bypasses RLS) — only on the server
export const supabaseAdmin = createClient(url, service);

// Build a client that uses a user’s JWT so RLS sees auth.uid()
export function supabaseForToken(jwt) {
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
