import { cookies } from "next/headers";
import { fromRow } from "../profile";
import { memberShell, type MemberShell } from "../shell";
import { currentUser } from "./claims";
import { createClient } from "./server";

/** Who is making this request, if they are logged in: what the desktop sidebar shows (email, daily target). For pages
 *  that look the same to everyone but offer members more (the dish result's "Log" button, the Get started form).
 *  Guests are recognised from the cookies alone, with no call to Supabase; a failure of any kind counts as "not a
 *  member" so the page still works. */
export async function memberInfo(): Promise<MemberShell | null> {
  const jar = await cookies();
  if (!jar.getAll().some((c) => c.name.startsWith("sb-"))) return null;
  try {
    const supabase = await createClient();
    const user = supabase ? await currentUser(supabase) : null;
    if (!supabase || !user) return null;
    const { data: row } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    return memberShell(user.email, fromRow(row));
  } catch {
    return null;
  }
}

/** Is the person making this request logged in? */
export async function isMember(): Promise<boolean> {
  return (await memberInfo()) !== null;
}
