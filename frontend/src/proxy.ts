import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Runs before the pages below (not the guest dish search, the APIs or static files).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/", "/home/:path*", "/login", "/signup", "/onboarding"],
};
