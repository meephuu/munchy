"use client";

import { useEffect, useState } from "react";
import { HeartIcon } from "@/components/Icons";
import { favoriteKey } from "@/lib/custom";
import { createClient } from "@/lib/supabase/client";

/** The heart on the Bite check: saves the dish (as searched) to the person's favorites, or takes it out.
 *  Favorites live in the Supabase `favorites` table and show up on Home. */
export function FavoriteButton({ title }: { title: string }) {
  const key = favoriteKey(title);
  const [saved, setSaved] = useState<boolean | null>(null); // null until we know
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } =
        (await createClient()
          ?.from("favorites")
          .select("id")
          .eq("key", key)
          .maybeSingle()) ?? {};
      if (!cancelled) setSaved(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  async function toggle() {
    const supabase = createClient();
    if (!supabase || busy || saved === null) return;
    setBusy(true);
    setFailed(false);
    const { error } = saved
      ? await supabase.from("favorites").delete().eq("key", key)
      : await supabase
          .from("favorites")
          .insert({ title: title.trim().slice(0, 500), key });
    setBusy(false);
    if (error) return setFailed(true);
    setSaved(!saved);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saved === null || busy}
      aria-pressed={saved === true}
      aria-label={saved ? "Remove from favorites" : "Save to favorites"}
      title={failed ? "Couldn't save, try again" : undefined}
      className={`flex size-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-row bg-surface shadow-row disabled:opacity-60 desk:h-12 desk:w-auto desk:rounded-[14px] desk:px-4 ${
        failed
          ? "text-terracotta-text"
          : saved
            ? "text-terracotta"
            : "text-ink-muted"
      }`}
    >
      <HeartIcon size={20} filled={saved === true} />
      <span className="hidden text-sm font-semibold text-ink desk:inline">
        {saved ? "Saved" : "Save"}
      </span>
    </button>
  );
}
