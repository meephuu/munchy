// Suggestions under the search bar on Home: dishes the person searched or logged before, their favorites, and
// new dishes they might like. The new ones come from a small curated list ranked by their goal (plain rules,
// no LLM), skipping anything they already know and rotating each day so the list does not stay the same.

import { favoriteKey } from "./custom";
import type { Goal } from "./target";

export type SuggestionKind = "favorite" | "recent" | "new";
export type Suggestion = { title: string; kind: SuggestionKind };

type Idea = { title: string; fits: Goal[] };

// Dishes the estimator handles well (Thai and common Western). `fits` = goals the dish suits.
const IDEAS: Idea[] = [
  { title: "Grilled chicken breast salad", fits: ["lose", "muscle"] },
  { title: "Tom yum goong", fits: ["lose", "maintain"] },
  { title: "Larb moo", fits: ["lose", "muscle"] },
  { title: "Steamed fish with lime", fits: ["lose", "muscle"] },
  { title: "Gaeng som with shrimp", fits: ["lose", "maintain"] },
  { title: "Papaya salad", fits: ["lose", "maintain"] },
  { title: "Boiled egg and avocado toast", fits: ["maintain", "muscle"] },
  { title: "Poached eggs on toast", fits: ["maintain", "muscle"] },
  { title: "Greek yogurt with banana and oats", fits: ["maintain", "lose", "muscle"] },
  { title: "Salmon with rice and broccoli", fits: ["muscle", "maintain"] },
  { title: "Chicken rice bowl", fits: ["muscle", "maintain", "gain"] },
  { title: "Beef steak with mashed potato", fits: ["muscle", "gain"] },
  { title: "Pad thai with shrimp", fits: ["maintain", "gain"] },
  { title: "Khao man gai", fits: ["maintain", "gain"] },
  { title: "Khao pad with egg", fits: ["maintain", "gain"] },
  { title: "Green curry with chicken and rice", fits: ["maintain", "gain"] },
  { title: "Massaman curry with rice", fits: ["gain"] },
  { title: "Khao soi", fits: ["gain", "maintain"] },
  { title: "Pork ribs with sticky rice", fits: ["gain"] },
  { title: "Peanut butter banana smoothie", fits: ["gain", "muscle"] },
  { title: "Spaghetti bolognese", fits: ["gain", "maintain"] },
  { title: "Tuna sandwich", fits: ["maintain", "muscle"] },
  { title: "Tofu stir fry with vegetables", fits: ["lose", "maintain"] },
  { title: "Kuay teow nam with pork", fits: ["maintain"] },
  { title: "Moo ping with sticky rice", fits: ["maintain", "gain"] },
  { title: "Omelette with rice", fits: ["maintain", "gain"] },
  { title: "Vegetable soup with chicken", fits: ["lose", "maintain"] },
  { title: "Oatmeal with fruit", fits: ["lose", "maintain"] },
];

/** The day of the year, to rotate the ideas once a day. */
export function dayNumber(now: Date): number {
  return Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 86_400_000);
}

/** New dishes to try: those that suit the goal first, none the person already has, a different set each day. */
export function newIdeas(goal: Goal | null, known: Iterable<string>, now: Date, limit = 4): Suggestion[] {
  const seen = new Set([...known].map(favoriteKey));
  const fresh = IDEAS.filter((i) => !seen.has(favoriteKey(i.title)));
  const fitting = fresh.filter((i) => goal && i.fits.includes(goal));
  const rest = fresh.filter((i) => !fitting.includes(i));
  const rotate = <T>(list: T[]) => {
    if (list.length === 0) return list;
    const at = dayNumber(now) % list.length;
    return [...list.slice(at), ...list.slice(0, at)];
  };
  return [...rotate(fitting), ...rotate(rest)].slice(0, limit).map((i) => ({ title: i.title, kind: "new" }));
}

/** Titles the person searched or logged, newest first (the input is already newest first), once each. */
export function recentDishes(titles: string[], limit = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of titles) {
    const key = favoriteKey(t);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t.trim());
    if (out.length === limit) break;
  }
  return out;
}

export type Pools = { favorites: string[]; recent: string[]; ideas: Suggestion[] };

/** What to show for what is typed. Empty box: favorites, recent, then new ideas. Typing: the known dishes that
 *  contain the text (ones that start with it first), then ideas that match. Each dish appears once. */
export function suggestionsFor(query: string, pools: Pools, limit = 6): Suggestion[] {
  const q = favoriteKey(query);
  const all: Suggestion[] = [
    ...pools.favorites.map((title) => ({ title, kind: "favorite" as const })),
    ...pools.recent.map((title) => ({ title, kind: "recent" as const })),
    ...pools.ideas,
  ];
  const seen = new Set<string>();
  const unique = all.filter((s) => {
    const key = favoriteKey(s.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!q) return unique.slice(0, limit);
  const hits = unique.filter((s) => favoriteKey(s.title).includes(q));
  const starts = hits.filter((s) => favoriteKey(s.title).startsWith(q));
  return [...starts, ...hits.filter((s) => !starts.includes(s))].slice(0, limit);
}
