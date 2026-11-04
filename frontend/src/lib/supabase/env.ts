// Where Supabase lives. Both values are public by design (the key only allows what the row-level
// security policies allow). When they are missing, accounts are simply switched off and the guest
// screens keep working.
//
// Supabase's dashboard calls the key NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (older projects: ..._ANON_KEY).
// Either name works. Each is written out in full because Next only inlines literal `process.env.NAME`.

export type SupabaseConfig = { url: string; key: string };

export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
