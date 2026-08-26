import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Public client — safe to use in client components. Respects RLS. */
export function supabasePublic() {
  return createClient(url, anonKey);
}

/**
 * Admin client — server-only, bypasses RLS via the service role key.
 * Never import this file from a "use client" component.
 */
export function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
