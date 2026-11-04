"use client";

import { useEffect, useState } from "react";
import { ChipLink } from "@/components/Chip";
import { Eyebrow } from "@/components/Type";
import { createClient } from "@/lib/supabase/client";

type Favorite = { id: string; title: string };

/** The dishes the person saved with the heart: tap one to look it up again. Shows nothing without favorites. */
export function FavoritesList() {
  const [list, setList] = useState<Favorite[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = (await createClient()?.from("favorites").select("id,title").order("created_at", { ascending: false }).limit(12)) ?? {};
      if (!cancelled && Array.isArray(data)) setList(data as Favorite[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow tone="muted">Favorites</Eyebrow>
      <div className="flex flex-wrap gap-2">
        {list.map((f) => (
          <ChipLink key={f.id} href={`/dish?q=${encodeURIComponent(f.title)}`}>
            {f.title}
          </ChipLink>
        ))}
      </div>
    </div>
  );
}
