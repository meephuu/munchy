import Image from "next/image";
import Link from "next/link";
import { ChipLink } from "@/components/Chip";
import { DishSearchBar } from "@/components/DishSearchBar";
import {
  ArrowRightIcon,
  BarsIcon,
  ChatIcon,
  UserIcon,
} from "@/components/Icons";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title, Wordmark } from "@/components/Type";

// Guest home (design/screens/Guest.dc.html, desktop/Guest.dc.html). Public: no account needed to search a dish.
// One page for both layouts: a phone shows the centered hero; from 1024 px the hero is two columns (the guest top
// bar comes from the shell) and the unlock card grows three feature tiles.

const TRY_DISHES = ["Pad kra pao", "Khao man gai", "Som tam"];

const FEATURES = [
  {
    icon: <UserIcon size={22} />,
    lead: "Daily target",
    accent: "for your body",
    text: "Calories, protein, carbs and fat worked out from your goal, body and typical day.",
  },
  {
    icon: <BarsIcon size={22} />,
    lead: "Meal log &",
    accent: "progress",
    text: "Log what you ate in one tap and see your week, streak and weight trend.",
  },
  {
    icon: <ChatIcon size={22} />,
    lead: "Coach ideas",
    accent: "for what's next",
    text: "Dishes that fit the room you have left today, sorted by best fit or protein.",
  },
];

export default function GuestHome() {
  return (
    <Screen shell={{ kind: "guest" }}>
      <div className="flex flex-1 flex-col gap-[18px] desk:flex-none desk:gap-12">
        <header className="flex items-center justify-between pt-2 desk:hidden">
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

        <section className="flex flex-col gap-[18px] desk:flex-row desk:flex-wrap desk:items-center desk:gap-12">
          <div className="flex min-w-0 flex-col gap-[18px] desk:flex-[1.2_1_480px] desk:gap-[22px]">
            <div className="flex flex-col items-center gap-3 pt-1 text-center desk:items-start desk:gap-[22px] desk:pt-0 desk:text-left">
              <Eyebrow className="hidden desk:block">
                Free · no account needed
              </Eyebrow>
              <Image
                src="/bowl.png"
                alt=""
                width={140}
                height={140}
                priority
                className="desk:hidden"
              />
              <Title
                lead="What's on your plate,"
                accent="and what's in it?"
                className="text-[28px] desk:text-[56px]"
              />
              <p className="text-sm leading-normal text-ink-muted desk:max-w-[520px] desk:text-lg desk:leading-normal">
                <span className="desk:hidden">
                  Type any dish and get calories &amp; nutrients in seconds. No
                  account needed.
                </span>
                <span className="hidden desk:inline">
                  Type any dish and get calories &amp; nutrients in seconds.
                  Thai or English, street stall or home-cooked.
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-2.5 desk:gap-[22px]">
              <div className="desk:max-w-[600px]">
                <DishSearchBar large />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Eyebrow className="tracking-[1px]">Try</Eyebrow>
                {TRY_DISHES.map((dish) => (
                  <ChipLink
                    key={dish}
                    href={`/dish?q=${encodeURIComponent(dish)}`}
                  >
                    {dish}
                  </ChipLink>
                ))}
                <span className="hidden desk:inline-flex">
                  <ChipLink
                    href={`/dish?q=${encodeURIComponent("ข้าวเหนียวหมูปิ้ง")}`}
                  >
                    ข้าวเหนียวหมูปิ้ง
                  </ChipLink>
                </span>
              </div>
            </div>
          </div>

          {/* the bowl on a sand circle with a sample estimate floating over it (desktop only) */}
          <div className="hidden min-w-0 justify-center desk:flex desk:flex-[1_1_380px]">
            <div className="relative aspect-square w-[440px] max-w-full">
              <div
                aria-hidden="true"
                className="absolute inset-[6%] rounded-full bg-sand"
              />
              <Image
                src="/bowl.png"
                alt="Ramen bowl illustration"
                width={440}
                height={440}
                priority
                className="absolute top-[12%] left-[12%] size-[76%]"
              />
              <div className="absolute bottom-[6%] -left-[4%] flex min-w-[210px] flex-col gap-2 rounded-[20px] bg-surface px-[18px] py-4 shadow-card">
                <Eyebrow className="text-[9px]">
                  Pad kra pao · fried egg
                </Eyebrow>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-brand text-[34px] leading-none text-green">
                    640
                  </span>
                  <span className="text-[13px] font-semibold">kcal</span>
                </div>
                <span className="flex gap-2.5 font-mono text-[11px]">
                  <span className="text-green">P 31g</span>
                  <span className="text-bronze">C 68g</span>
                  <span className="text-terracotta-text">F 27g</span>
                </span>
              </div>
              <div className="absolute top-[10%] right-0 flex items-center gap-2 rounded-row bg-surface px-3.5 py-2.5 shadow-row">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-green"
                />
                <span className="text-[13px] font-semibold">Range 550–730</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-auto flex flex-col gap-3 rounded-panel bg-surface p-[18px] shadow-panel desk:mt-0 desk:gap-6 desk:rounded-[22px] desk:p-8 desk:shadow-card">
          <div className="flex flex-col gap-3 desk:flex-row desk:flex-wrap desk:items-end desk:justify-between desk:gap-4">
            <div className="flex flex-col gap-3 desk:gap-2">
              <Eyebrow>Free account</Eyebrow>
              <Title
                lead="Unlock your"
                accent="Bite Buddy"
                as="h2"
                className="text-[19px] desk:text-[30px]"
              />
            </div>
            <Link
              href="/onboarding"
              className="hidden h-[52px] items-center gap-2 rounded-btn bg-green px-7 text-[15px] font-semibold text-bg hover:bg-green-dark desk:flex"
            >
              Create free account
              <ArrowRightIcon size={20} />
            </Link>
          </div>
          <p className="text-[13px] leading-normal text-ink-muted desk:hidden">
            Daily target built for your body, meal log &amp; progress, and coach
            ideas for what to eat next.
          </p>
          <div className="hidden flex-wrap gap-4 desk:flex">
            {FEATURES.map((f) => (
              <div
                key={f.lead}
                className="flex min-w-0 flex-[1_1_240px] flex-col gap-2.5 rounded-panel bg-bg p-[22px]"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-field bg-green-tint text-green"
                >
                  {f.icon}
                </span>
                <h3 className="font-heading text-[19px] leading-[1.12] font-semibold">
                  {f.lead} <span className="text-green italic">{f.accent}</span>
                </h3>
                <p className="text-sm leading-normal text-ink-muted">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/onboarding"
            className="flex h-[52px] items-center justify-center rounded-card bg-green text-[15px] font-semibold text-bg hover:bg-green-dark desk:hidden"
          >
            Create free account
          </Link>
        </section>

        <p className="hidden text-center font-mono text-[10px] tracking-[0.5px] text-ink-muted uppercase desk:block">
          Estimates are approximate · Not medical advice
        </p>
      </div>
    </Screen>
  );
}
