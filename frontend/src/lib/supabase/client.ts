import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./env";

/** Supabase in the browser (sign-up, log-in, log-out, saving the profile). Null if not configured.
 *  The session lives in cookies, so server components and the proxy see the same login. */
export function createClient() {
  const config = supabaseConfig();
  return config ? createBrowserClient(config.url, config.key) : null;
}
