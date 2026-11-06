"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CheckIcon } from "@/components/Icons";
import { Eyebrow } from "@/components/Type";

// What is happening while a dish is worked out. A dish seen before is instant; a new one needs the language
// model twice (read it, then look up what is usually in it) and can take 30 seconds, so the wait says so, with a
// bowl that bobs in the steam and a list of steps that tick off as the seconds pass.
const STEPS: { from: number; text: string }[] = [
  { from: 0, text: "Reading your dish" },
  { from: 4, text: "Finding what's usually in it" },
  { from: 12, text: "Adding it up" },
];
const SLOW_AFTER = 25;

const STEAM = [
  { left: "36%", delay: "0s" },
  { left: "50%", delay: "0.7s" },
  { left: "64%", delay: "1.4s" },
];

export function LoadingSteps() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const current = STEPS.reduce((n, s, i) => (seconds >= s.from ? i : n), 0);
  const slow = seconds >= SLOW_AFTER;

  return (
    <section
      aria-live="polite"
      className="flex flex-col items-center gap-5 overflow-hidden rounded-hero bg-surface px-5 py-7 shadow-card desk:max-w-[880px] desk:flex-row desk:gap-10 desk:px-10 desk:py-9"
    >
      <div className="relative size-[150px] shrink-0 desk:size-[190px]">
        <div
          aria-hidden="true"
          className="absolute inset-[8%] rounded-full bg-sand"
        />
        {STEAM.map((s) => (
          <svg
            key={s.left}
            aria-hidden="true"
            viewBox="0 0 12 28"
            className="absolute top-0 h-7 w-3 animate-[steam-rise_2.4s_ease-out_infinite] text-green/40 motion-reduce:animate-none"
            style={{ left: s.left, animationDelay: s.delay }}
          >
            <path
              d="M6 27c-5-6 5-9 0-14S7 4 6 1"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        ))}
        <Image
          src="/bowl.png"
          alt=""
          width={190}
          height={190}
          priority
          className="absolute inset-x-0 bottom-0 mx-auto h-[82%] w-[82%] animate-[bowl-bob_2.4s_ease-in-out_infinite] motion-reduce:animate-none"
        />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1.5 text-center desk:text-left">
          <Eyebrow>Working it out</Eyebrow>
          <p className="font-heading text-[22px] leading-tight font-semibold desk:text-[28px]">
            Cooking up your <span className="text-green italic">estimate</span>
          </p>
        </div>

        <ol className="flex flex-col gap-2.5">
          {STEPS.map((s, i) => {
            const done = i < current;
            const now = i === current;
            return (
              <li
                key={s.text}
                className={`flex items-center gap-3 text-sm ${
                  i > current ? "text-ink-muted/50" : ""
                } ${i <= current ? "animate-[step-in_0.35s_ease-out] motion-reduce:animate-none" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? "bg-green text-bg"
                      : now
                        ? "border-2 border-green"
                        : "border-2 border-sand"
                  }`}
                >
                  {done ? (
                    <CheckIcon size={14} />
                  ) : now ? (
                    <span className="size-2 animate-pulse rounded-full bg-green" />
                  ) : null}
                </span>
                <span className={now ? "font-semibold" : ""}>
                  {s.text}
                  {now && "…"}
                </span>
              </li>
            );
          })}
        </ol>

        <div
          aria-hidden="true"
          className="relative h-1.5 overflow-hidden rounded-[3px] bg-sand"
        >
          <div className="absolute inset-y-0 left-0 w-2/5 animate-[bar-sweep_1.6s_ease-in-out_infinite] rounded-[3px] bg-green motion-reduce:animate-none" />
        </div>
        <p className="min-h-[1.25rem] text-center text-xs text-ink-muted desk:text-left">
          {slow
            ? "New dishes take a little longer the first time. Almost there…"
            : "Dishes we've seen before are instant."}
        </p>
      </div>
    </section>
  );
}
