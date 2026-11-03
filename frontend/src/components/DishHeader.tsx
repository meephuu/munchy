import Link from "next/link";
import { ArrowLeftIcon } from "@/components/Icons";

/** "Bite check" top bar shared by the result, loading and error states. */
export function DishHeader() {
  return (
    <header className="flex items-center justify-between pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back to search"
          className="flex size-11 items-center justify-center rounded-row bg-white text-ink"
        >
          <ArrowLeftIcon size={20} />
        </Link>
        <h1 className="font-display text-xl font-normal text-ink">Bite check</h1>
      </div>
      <Link href="/login" className="text-sm font-semibold">
        Log in
      </Link>
    </header>
  );
}
