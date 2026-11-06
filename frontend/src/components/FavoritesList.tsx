import { ChipLink } from "@/components/Chip";
import { Eyebrow } from "@/components/Type";

export type FavoriteItem = { id: string; title: string };

/** The dishes the person saved with the heart: tap one to look it up again. Shows nothing without favorites.
 *  The page (server) loads the list, so there is no wait here. `card` puts it on a white card (desktop side column). */
export function FavoritesList({
  items,
  card = false,
}: {
  items: FavoriteItem[];
  card?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className={
        card
          ? "flex flex-col gap-3 rounded-hero bg-surface p-[22px] shadow-card"
          : "flex flex-col gap-2"
      }
    >
      <Eyebrow tone={card ? "bronze" : "muted"}>Favorites</Eyebrow>
      <div className="flex flex-wrap gap-2">
        {items.map((f) => (
          <ChipLink key={f.id} href={`/dish?q=${encodeURIComponent(f.title)}`}>
            {f.title}
          </ChipLink>
        ))}
      </div>
    </div>
  );
}
