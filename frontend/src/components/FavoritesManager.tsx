"use client";

import { useEffect, useState } from "react";
import { ChipLink } from "@/components/Chip";
import { TrashIcon } from "@/components/Icons";
import { Eyebrow, Title } from "@/components/Type";
import { favoriteKey } from "@/lib/custom";
import { friendlyMealError } from "@/lib/meals";
import { createClient } from "@/lib/supabase/client";

type Favorite = { id: string; title: string; key: string };

/** Favorites on the Log screen: tap one to look it up, or press Edit to rename (change what is in the dish,
 *  e.g. "caesar salad, no croutons") or remove them. A favorite is the text that gets searched, so renaming
 *  changes what the next search estimates. */
export function FavoritesManager() {
  const [list, setList] = useState<Favorite[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } =
        (await createClient()
          ?.from("favorites")
          .select("id,title,key")
          .order("created_at", { ascending: false })) ?? {};
      if (cancelled) return;
      if (error) setError(friendlyMealError(error));
      setList(Array.isArray(data) ? (data as Favorite[]) : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function rename(fav: Favorite, title: string): Promise<boolean> {
    const clean = title.trim().replace(/\s+/g, " ").slice(0, 500);
    const key = favoriteKey(clean);
    if (!key) {
      setError("A favorite needs a name.");
      return false;
    }
    if (key === fav.key) return true; // only spacing or capital letters changed
    if (list?.some((f) => f.key === key)) {
      setError(`"${clean}" is already in your favorites.`);
      return false;
    }
    setError(null);
    const supabase = createClient();
    if (!supabase) return false;
    // add the new name first, so a failure never loses the old favorite
    const added = await supabase
      .from("favorites")
      .insert({ title: clean, key })
      .select("id,title,key")
      .single();
    if (added.error || !added.data) {
      setError(
        added.error
          ? friendlyMealError(added.error)
          : "We couldn't save that. Please try again.",
      );
      return false;
    }
    const removed = await supabase.from("favorites").delete().eq("id", fav.id);
    const saved = added.data as Favorite;
    setList((all) => [
      saved,
      ...(all ?? []).filter((f) => removed.error || f.id !== fav.id),
    ]);
    if (removed.error)
      setError("Saved, but the old name is still there. Remove it below.");
    return true;
  }

  async function remove(fav: Favorite) {
    const before = list;
    setError(null);
    setList((all) => (all ?? []).filter((f) => f.id !== fav.id));
    const { error } = (await createClient()
      ?.from("favorites")
      .delete()
      .eq("id", fav.id)) ?? { error: { message: "off" } };
    if (error) {
      setList(before);
      setError(friendlyMealError(error));
    }
  }

  if (!list) return null;
  if (list.length === 0 && !error) {
    // nothing saved: say so on desktop (the card is part of the layout), stay out of the way on a phone
    return (
      <section className="hidden flex-col gap-3.5 rounded-hero bg-surface p-6 shadow-card desk:flex">
        <Title as="h2" lead="My" accent="favorites" className="text-[22px]" />
        <span className="text-[13px] text-ink-muted">
          Save a dish with the heart on its Bite check to find it here.
        </span>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2 desk:gap-3.5 desk:rounded-hero desk:bg-surface desk:p-6 desk:shadow-card">
      <div className="flex items-baseline justify-between">
        <Title
          as="h2"
          lead="My"
          accent="favorites"
          className="text-lg desk:text-[22px]"
        />
        {list.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setError(null);
            }}
            className="cursor-pointer text-sm font-semibold text-green"
          >
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-card bg-terracotta-tint px-3.5 py-2.5 text-[13px]"
        >
          {error}
        </p>
      )}

      {editing ? (
        <ul className="flex flex-col gap-2">
          {list.map((f) => (
            <FavoriteRow
              key={f.id}
              fav={f}
              onRename={rename}
              onRemove={remove}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((f) => (
            <ChipLink
              key={f.id}
              href={`/dish?q=${encodeURIComponent(f.title)}`}
            >
              {f.title}
            </ChipLink>
          ))}
        </div>
      )}
      {editing && (
        <Eyebrow tone="muted">
          Change the name to change what gets estimated
        </Eyebrow>
      )}
    </section>
  );
}

function FavoriteRow({
  fav,
  onRename,
  onRemove,
}: {
  fav: Favorite;
  onRename: (fav: Favorite, title: string) => Promise<boolean>;
  onRemove: (fav: Favorite) => void;
}) {
  const [text, setText] = useState(fav.title);
  const [saving, setSaving] = useState(false);
  const changed = text.trim() !== fav.title;

  return (
    <li className="flex items-center gap-2 rounded-row bg-surface py-2 pr-1.5 pl-3.5 shadow-row">
      <input
        aria-label={`Rename ${fav.title}`}
        value={text}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        className="h-10 min-w-0 flex-1 rounded-field border border-border bg-bg px-2.5 text-[14px] text-ink outline-none focus:border-green"
      />
      {changed && (
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const ok = await onRename(fav, text);
            if (!ok) setSaving(false);
          }}
          className="h-10 cursor-pointer rounded-field bg-green px-3 text-[13px] font-semibold text-bg disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      )}
      <button
        type="button"
        aria-label={`Remove ${fav.title}`}
        onClick={() => onRemove(fav)}
        className="flex size-10 shrink-0 cursor-pointer items-center justify-center text-ink-muted"
      >
        <TrashIcon size={16} />
      </button>
    </li>
  );
}
