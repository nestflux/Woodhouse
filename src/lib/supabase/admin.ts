import "server-only";
import { createClient as _createClient } from "@supabase/supabase-js";

/**
 * Admin client using the service role key — bypasses RLS.
 * For use in server-side code ONLY.
 * NEVER import this from frontend code.
 */
export function createClient() {
  return _createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
