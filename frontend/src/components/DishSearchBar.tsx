import Form from "next/form";
import { ArrowRightIcon, SearchIcon } from "@/components/Icons";

/** The dish search of the logged-in screens: asks for a dish and opens /dish?q=… (design Main.dc.html). */
export function DishSearchBar({ placeholder = "e.g. pad kra pao with fried egg" }: { placeholder?: string }) {
  return (
    <Form
      action="/dish"
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
  );
}
