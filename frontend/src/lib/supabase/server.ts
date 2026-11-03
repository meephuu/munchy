import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabaseConfig } from "./env";

/** Supabase for server components: reads the login from the request's cookies. Null if not configured.
 *  Reading the login is request-time work, so callers sit behind <Suspense>; `connection()` marks it
 *  as such before the Supabase client (which reads the clock to check token expiry) runs. */
export async function createClient() {
  const config = supabaseConfig();
  if (!config) return null;
  await connection();
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a server component, which cannot set cookies: the proxy refreshes the session.
        }
      },
    },
  });
}
