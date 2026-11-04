import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./env";

// Pages only for people who are logged in, and pages only for people who are not.
const MEMBERS_ONLY = ["/home", "/add", "/coach", "/progress", "/account"];
const GUESTS_ONLY = ["/", "/login", "/signup"];

const matches = (path: string, list: string[]) => list.some((p) => path === p || (p !== "/" && path.startsWith(p + "/")));

/** Keeps the Supabase login fresh on every request that matters and sends people to the right side:
 *  logged-in people skip the guest pages, guests are sent to log in when they ask for member pages.
 *  This is a convenience check (it reads the cookie); every member page also asks Supabase itself. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const config = supabaseConfig();
  const path = request.nextUrl.pathname;
  let response = NextResponse.next({ request });
  if (!config) return response;

  // No Supabase cookie at all: certainly a guest, no need to ask Supabase.
  const hasLogin = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

  let loggedIn = false;
  if (hasLogin) {
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await supabase.auth.getUser(); // also refreshes an expiring token into `response`
    loggedIn = !!data.user;
  }

  const redirect = (to: string) => {
    const res = NextResponse.redirect(new URL(to, request.url));
    response.cookies.getAll().forEach((c) => res.cookies.set(c)); // keep any refreshed login cookies
    return res;
  };

  if (!loggedIn && matches(path, MEMBERS_ONLY)) return redirect("/login");
  if (loggedIn && matches(path, GUESTS_ONLY)) return redirect("/home");
  return response;
}
