import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (service role) - NEVER expose in browser
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder";
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
