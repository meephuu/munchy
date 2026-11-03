import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where the link in the confirmation email lands: swap the one-time code for a login, then go home.
// If the link is old or already used, send them to log in with a note instead.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const supabase = await createClient();

  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/home`);
  }
  return NextResponse.redirect(`${origin}/login?notice=confirm`);
}
