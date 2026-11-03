"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, PlusIcon, SearchIcon } from "@/components/Icons";
import { searchFoods, type FoodHit } from "@/lib/foods";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

/** Search the food database as you type and pick a food to add to the meal. */
export function IngredientSearch({
  onPick,
  onClose,
}: {
  onPick: (food: FoodHit) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const listRef = useRef<HTMLUListElement>(null);

  const q = query.trim();
  const searching = q.length >= MIN_CHARS;

  // Wait for a pause in typing, then ask; a newer keystroke cancels the older request.
  useEffect(() => {
    if (q.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        setHits(await searchFoods(q, controller.signal));
        setStatus("done");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  // New suggestions can land under the floating sign-up button: bring them into view.
  useEffect(() => {
    listRef.current?.scrollIntoView({ block: "nearest" });
  }, [hits]);

  return (
    <div className="flex flex-col gap-1 pb-3">
      <div className="flex h-11 items-center gap-2 rounded-field border border-border bg-white pr-1 pl-3">
        <SearchIcon size={16} className="shrink-0 text-ink-faint" />
        <input
          type="text"
          autoFocus
          autoComplete="off"
          aria-label="Search for an ingredient"
          placeholder="Search a food, e.g. fried egg"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 scroll-mb-32 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
        />
        <button
          type="button"
          aria-label="Close search"
          onClick={onClose}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center text-ink-muted"
        >
          <CloseIcon size={18} />
        </button>
      </div>

      {searching && status === "error" && (
        <p role="alert" className="py-2 text-xs text-ink-muted">
          Search isn&apos;t available right now. Try again in a moment.
        </p>
      )}
      {searching && status === "done" && hits.length === 0 && (
        <p className="py-2 text-xs text-ink-muted">No foods found for “{q}”. Try another word.</p>
      )}
      {searching && status === "loading" && hits.length === 0 && (
        <p role="status" className="py-2 text-xs text-ink-muted">
          Searching…
        </p>
      )}
      {searching && status !== "error" && hits.length > 0 && (
        <ul ref={listRef} className="flex scroll-mb-32 flex-col">
          {hits.map((hit) => (
            <li key={hit.id} className="border-b border-divider last:border-b-0">
              <button
                type="button"
                onClick={() => onPick(hit)}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 py-2 text-left"
              >
                <span className="flex-1 text-sm first-letter:uppercase">{hit.name}</span>
                <span className="text-xs text-ink-muted">{Math.round(hit.per_100g.kcal)} kcal / 100 g</span>
                <PlusIcon size={16} className="shrink-0 text-teal" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
