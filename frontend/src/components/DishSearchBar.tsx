"use client";

import Form from "next/form";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRightIcon, SearchIcon } from "@/components/Icons";
import { createClient } from "@/lib/supabase/client";
import {
  newIdeas,
  recentDishes,
  suggestionsFor,
  type Pools,
  type SuggestionKind,
} from "@/lib/suggest";
import type { Goal } from "@/lib/target";

// Searches done on this device (newest first). Kept in the browser only; a private window or blocked storage
// just means no search history.
const SEARCHES_KEY = "munchy.recent-searches";

function readSearches(): string[] {
  try {
    const list: unknown = JSON.parse(
      localStorage.getItem(SEARCHES_KEY) ?? "[]",
    );
    return Array.isArray(list)
      ? list.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function rememberSearch(title: string) {
  try {
    localStorage.setItem(
      SEARCHES_KEY,
      JSON.stringify(recentDishes([title, ...readSearches()], 20)),
    );
  } catch {
    // storage unavailable: nothing to remember
  }
}

const TAGS: Record<SuggestionKind, string> = {
  favorite: "Favorite",
  recent: "Recent",
  new: "Try",
};

/** The dish search of the logged-in screens: asks for a dish and opens /dish?q=… (design Main.dc.html).
 *  With `suggest`, a panel under the box offers favorites, dishes searched or logged before, and new dishes
 *  that suit the person's goal; typing narrows it down. */
export function DishSearchBar({
  placeholder = "e.g. pad kra pao with fried egg",
  suggest = false,
  goal = null,
}: {
  placeholder?: string;
  suggest?: boolean;
  goal?: Goal | null;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [pools, setPools] = useState<Pools | null>(null);

  // Loaded when the box is first focused (not on page load): favorites and logged meals from Supabase, searches from this device.
  async function load() {
    if (!suggest || pools) return;
    const supabase = createClient();
    const [favs, meals] = supabase
      ? await Promise.all([
          supabase
            .from("favorites")
            .select("title")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("meals")
            .select("title")
            .order("eaten_at", { ascending: false })
            .limit(60),
        ])
      : [null, null];
    const titles = (r: typeof favs) =>
      ((r?.data ?? []) as { title: string }[]).map((x) => x.title);
    const favorites = titles(favs);
    const recent = recentDishes([...readSearches(), ...titles(meals)]);
    setPools({
      favorites,
      recent,
      ideas: newIdeas(goal, [...favorites, ...recent], new Date()),
    });
  }

  const shown = useMemo(
    () => (pools ? suggestionsFor(text, pools) : []),
    [pools, text],
  );
  const showPanel = suggest && open && shown.length > 0;

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Form
        action="/dish"
        onSubmit={() => rememberSearch(text)}
        className="flex h-14 items-center gap-2 rounded-card bg-surface py-1.5 pr-1.5 pl-3.5 shadow-search"
      >
        <label htmlFor="dish" className="sr-only">
          Dish name
        </label>
        <SearchIcon size={18} className="shrink-0 text-placeholder" />
        <input
          id="dish"
          name="q"
          type="text"
          required
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            setOpen(true);
            void load();
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
        />
        <button
          type="submit"
          aria-label="Analyze dish"
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field bg-green text-bg hover:bg-green-dark"
        >
          <ArrowRightIcon size={20} />
        </button>
      </Form>

      {showPanel && (
        <ul
          aria-label="Suggestions"
          onMouseDown={(e) => e.preventDefault()} // keep the box focused so a tap on a suggestion is not lost to the blur
          className="absolute inset-x-0 top-full z-20 mt-1.5 flex flex-col overflow-hidden rounded-card bg-surface py-1 shadow-panel"
        >
          {shown.map((s) => (
            <li key={`${s.kind}-${s.title}`}>
              <Link
                href={`/dish?q=${encodeURIComponent(s.title)}`}
                onClick={() => rememberSearch(s.title)}
                className="flex min-h-11 items-center gap-3 px-3.5 py-2 text-sm text-ink"
              >
                <span className="min-w-0 flex-1 truncate first-letter:uppercase">
                  {s.title}
                </span>
                <span
                  className={`shrink-0 font-mono text-[9px] tracking-[1px] uppercase ${s.kind === "new" ? "text-bronze" : "text-ink-muted"}`}
                >
                  {TAGS[s.kind]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
