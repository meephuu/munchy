import { cookies } from "next/headers";
import { createClient } from "./server";

/** Is the person making this request logged in? For pages that look the same to everyone but offer
 *  members more (the dish result's "Log" button). Guests are recognised from the cookies alone, with
 *  no call to Supabase; a failure of any kind counts as "not a member" so the page still works. */
export async function isMember(): Promise<boolean> {
  const jar = await cookies();
  if (!jar.getAll().some((c) => c.name.startsWith("sb-"))) return false;
  try {
    const supabase = await createClient();
    const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    return !!data.user;
  } catch {
    return false;
  }
}
