import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { ChipLink } from "@/components/Chip";
import { ArrowRightIcon, LockIcon, SearchIcon } from "@/components/Icons";
import { Screen } from "@/components/Screen";

// Guest home (design/screens/Guest.dc.html). Public: no account needed to search a dish.

const TRY_DISHES = ["Pad kra pao", "Khao man gai", "Som tam", "Tom yum"];

const PERKS = [
  "Daily target built for your body",
  "Meal log, streaks & progress",
  "Coach ideas for what to eat next",
];

export default function GuestHome() {
  return (
    <Screen>
      <div className="flex flex-col gap-[18px]">
        <header className="flex items-center justify-between pt-2">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[30px] leading-none text-olive-logo">Munchy</span>
            <span className="text-xs text-ink-muted">Your Bite Buddy</span>
          </div>
          <Link
            href="/onboarding"
            className="flex h-11 items-center rounded-full border-[1.5px] border-teal px-[18px] text-sm font-semibold"
          >
            Log in
          </Link>
        </header>

        <div className="flex flex-col items-center gap-3 pt-1.5 text-center">
          <Image src="/bowl.png" alt="" width={150} height={150} priority />
          <h1 className="font-display text-2xl leading-[1.2] font-normal text-ink">
            What&apos;s on your plate?
          </h1>
          <p className="text-sm leading-normal text-ink-muted">
            Type any dish and get calories &amp; nutrients in seconds. No account needed.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Form
            action="/dish"
            className="flex h-14 items-center gap-2 rounded-card border border-line-soft bg-white py-1.5 pr-1.5 pl-3.5"
          >
            <label htmlFor="dish" className="sr-only">
              Dish name
            </label>
            <SearchIcon size={18} className="shrink-0 text-ink-faint" />
            <input
              id="dish"
              name="q"
              type="text"
              required
              autoComplete="off"
              placeholder="e.g. pad kra pao with fried egg"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
            />
            <button
              type="submit"
              aria-label="Analyze dish"
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field bg-teal text-cream"
            >
              <ArrowRightIcon size={20} />
            </button>
          </Form>

          <div className="flex flex-wrap gap-2">
            <span className="self-center text-xs text-ink-muted">Try:</span>
            {TRY_DISHES.map((dish) => (
              <ChipLink key={dish} href={`/dish?q=${encodeURIComponent(dish)}`}>
                {dish}
              </ChipLink>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-auto flex flex-col gap-3 rounded-panel bg-olive p-[18px]">
        <h2 className="font-display text-[15px] font-normal text-ink-strong">
          Unlock your Bite Buddy
        </h2>
        <ul className="flex flex-col gap-2">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-center gap-2.5 text-[13px]">
              <LockIcon size={16} className="shrink-0 text-teal" />
              {perk}
            </li>
          ))}
        </ul>
        <Link
          href="/onboarding"
          className="flex h-[52px] items-center justify-center rounded-card bg-teal text-[15px] font-semibold text-cream"
        >
          Create free account
        </Link>
      </section>
    </Screen>
  );
}
