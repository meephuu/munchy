import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { ChipLink } from "@/components/Chip";
import { ArrowRightIcon, SearchIcon } from "@/components/Icons";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title, Wordmark } from "@/components/Type";

// Guest home (design/screens/Guest.dc.html). Public: no account needed to search a dish.

const TRY_DISHES = ["Pad kra pao", "Khao man gai", "Som tam"];

export default function GuestHome() {
  return (
    <Screen>
      <div className="flex flex-col gap-[18px]">
        <header className="flex items-center justify-between pt-2">
          <div className="flex flex-col gap-1">
            <Wordmark />
            <Eyebrow>Your Bite Buddy</Eyebrow>
          </div>
          <Link
            href="/login"
            className="flex h-11 items-center rounded-full border-[1.5px] border-green px-[18px] text-sm font-semibold"
          >
            Log in
          </Link>
        </header>

        <div className="flex flex-col items-center gap-3 pt-1 text-center">
          <Image src="/bowl.png" alt="" width={140} height={140} priority />
          <Title lead="What's on your plate," accent="and what's in it?" className="text-[28px]" />
          <p className="text-sm leading-normal text-ink-muted">
            Type any dish and get calories &amp; nutrients in seconds. No account needed.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
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
              placeholder="e.g. pad kra pao with fried egg"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none"
            />
            <button
              type="submit"
              aria-label="Analyze dish"
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field bg-green text-bg hover:bg-green-dark"
            >
              <ArrowRightIcon size={20} />
            </button>
          </Form>

          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow className="tracking-[1px]">Try</Eyebrow>
            {TRY_DISHES.map((dish) => (
              <ChipLink key={dish} href={`/dish?q=${encodeURIComponent(dish)}`}>
                {dish}
              </ChipLink>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-auto flex flex-col gap-3 rounded-panel bg-surface p-[18px] shadow-panel">
        <Eyebrow>Free account</Eyebrow>
        <Title lead="Unlock your" accent="Bite Buddy" as="h2" className="text-[19px]" />
        <p className="text-[13px] leading-normal text-ink-muted">
          Daily target built for your body, meal log &amp; progress, and coach ideas for what to eat next.
        </p>
        <Link
          href="/onboarding"
          className="flex h-[52px] items-center justify-center rounded-card bg-green text-[15px] font-semibold text-bg hover:bg-green-dark"
        >
          Create free account
        </Link>
      </section>
    </Screen>
  );
}
