import type { SupabaseClient } from "@supabase/supabase-js";

export type CurrentUser = { id: string; email: string | null };

/** Who is making this request, read from the login's signed token (getClaims) instead of asking Supabase's
 *  server (getUser). The token is checked against the project's public signing key, which is fetched once and
 *  cached, so this costs no round trip per page. An expired token is refreshed first. Any database read the page
 *  makes afterwards is still checked by row-level security. Null when nobody is logged in. */
export async function currentUser(
  supabase: SupabaseClient,
): Promise<CurrentUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}
