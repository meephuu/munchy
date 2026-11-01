// Dish result data + the live recalculation from the design prototype
// (design/screens/GuestDish.dc.html). Numbers here are FIXTURES from the design, not real
// estimates: the screen is not wired to the backend's POST /estimate yet.

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export type PlaceId = "stall" | "resto" | "home";
export type ModId = "oil" | "egg" | "rice" | "pork";

type Place = { id: PlaceId; label: string; kcal: number };
type Mod = { id: ModId; label: string } & Macros;

export type Part = { name: string; amount: string; kcal: number; dot: string };

export const PLACES: Place[] = [
  { id: "stall", label: "Street stall", kcal: 0 },
  { id: "resto", label: "Restaurant", kcal: 40 },
  { id: "home", label: "Home-cooked", kcal: -60 },
];

export const MODS: Mod[] = [
  { id: "oil", label: "Less oil", kcal: -60, protein: 0, carbs: 0, fat: -7 },
  { id: "egg", label: "No egg", kcal: -110, protein: -7, carbs: 0, fat: -9 },
  { id: "rice", label: "Half rice", kcal: -125, protein: -2, carbs: -28, fat: 0 },
  { id: "pork", label: "Extra pork", kcal: 80, protein: 8, carbs: 0, fat: 6 },
];

export const DISH = {
  title: "Pad kra pao, minced pork, fried egg, rice",
  confidence: "Medium",
  base: { kcal: 650, protein: 32, carbs: 78, fat: 24 } satisfies Macros,
  sodiumG: 1.3,
};

export type Selection = { place: PlaceId; mods: Partial<Record<ModId, boolean>> };

export const DEFAULT_SELECTION: Selection = { place: "stall", mods: {} };

export type DishView = Macros & { low: number; high: number; parts: Part[] };

/** Apply the chosen place and tweaks to the base dish. A place only moves kcal and fat (fat takes
 *  the kcal change at 9 kcal/g); each tweak moves all four numbers. */
export function computeDish({ place, mods }: Selection): DishView {
  let { kcal, protein, carbs, fat } = DISH.base;

  const placeKcal = PLACES.find((p) => p.id === place)?.kcal ?? 0;
  kcal += placeKcal;
  fat += Math.round(placeKcal / 9);

  for (const m of MODS) {
    if (!mods[m.id]) continue;
    kcal += m.kcal;
    protein += m.protein;
    carbs += m.carbs;
    fat += m.fat;
  }

  // The estimate is shown as roughly +/-14%, rounded to the nearest 10.
  const round10 = (n: number) => Math.round(n / 10) * 10;

  const parts: Part[] = [
    {
      name: "Jasmine rice",
      amount: mods.rice ? "100 g" : "200 g",
      kcal: mods.rice ? 125 : 250,
      dot: "var(--color-yolk)",
    },
    {
      name: "Minced pork",
      amount: mods.pork ? "130 g" : "90 g",
      kcal: mods.pork ? 240 : 160,
      dot: "var(--color-orange)",
    },
    {
      name: "Fried egg",
      amount: mods.egg ? "—" : "1 egg",
      kcal: mods.egg ? 0 : 110,
      dot: "var(--color-egg)",
    },
    {
      name: "Oil, basil & sauce",
      amount: mods.oil ? "½ tbsp" : "1 tbsp",
      kcal: mods.oil ? 70 : 130,
      dot: "var(--color-teal)",
    },
  ];

  return { kcal, protein, carbs, fat, low: round10(kcal * 0.86), high: round10(kcal * 1.14), parts };
}
