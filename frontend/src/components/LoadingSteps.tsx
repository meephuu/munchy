import { BitingLogo } from "@/components/BitingLogo";
import { CheckIcon } from "@/components/Icons";
import { Eyebrow } from "@/components/Type";

// What is happening while a dish is worked out. A dish seen before is instant; a new one needs the language
// model twice (read it, then look up what is usually in it) and can take 30 seconds, so the wait says so, with the
// M logo being eaten bite by bite and a list of steps that tick off as the seconds pass.
//
// No JavaScript runs here (see BitingLogo): the dish page shows this while the server is still working, before React
// hydrates it. So the steps are CSS animations with delays: each step has a "waiting", a "now" and a "done" look, and
// the delays swap them at the right second (`step-show` / `step-hide` in globals.css).
const STEPS: { from: number; text: string }[] = [
  { from: 0, text: "Reading your dish" },
  { from: 4, text: "Finding what's usually in it" },
  { from: 12, text: "Adding it up" },
];
const SLOW_AFTER = 25;

// `show` fades a layer in at second `at` (it starts invisible); `hide` fades it out at `at` (it starts visible); `during`
// does both, for a layer that is there between two moments.
const SHOW = "step-show 0.3s ease-out both";
const HIDE = "step-hide 0.3s ease-out forwards";
const show = (at: number) => ({ animation: SHOW, animationDelay: `${at}s` });
const hide = (at: number) => ({ animation: HIDE, animationDelay: `${at}s` });
const during = (from: number, to?: number) =>
  to === undefined
    ? show(from)
    : { animation: `${SHOW}, ${HIDE}`, animationDelay: `${from}s, ${to}s` };

export function LoadingSteps() {
  return (
    <section
      aria-live="polite"
      className="flex flex-col items-center gap-5 overflow-hidden rounded-hero bg-surface px-5 py-7 shadow-card desk:max-w-[880px] desk:flex-row desk:gap-10 desk:px-10 desk:py-9"
    >
      <div className="relative size-[210px] shrink-0 desk:size-[190px]">
        <BitingLogo className="absolute inset-0 size-full" />
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
            const next = STEPS[i + 1]?.from;
            return (
              <li key={s.text} className="flex items-center gap-3 text-sm">
                {/* the round marker: waiting, now (pulsing dot), done (tick), swapped by the delays */}
                <span aria-hidden="true" className="relative size-6 shrink-0">
                  <span
                    className={`absolute inset-0 rounded-full border-2 border-sand ${s.from === 0 ? "opacity-0" : ""}`}
                    style={s.from > 0 ? hide(s.from) : undefined}
                  />
                  <span
                    className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-green opacity-0"
                    style={during(s.from, next)}
                  >
                    <span className="size-2 animate-pulse rounded-full bg-green" />
                  </span>
                  {next !== undefined && (
                    <span
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-green text-bg opacity-0"
                      style={show(next)}
                    >
                      <CheckIcon size={14} />
                    </span>
                  )}
                </span>
                <span className="grid">
                  <span
                    className={`col-start-1 row-start-1 text-ink-muted/50 ${s.from === 0 ? "opacity-0" : ""}`}
                    style={s.from > 0 ? hide(s.from) : undefined}
                  >
                    {s.text}
                  </span>
                  <span
                    className="col-start-1 row-start-1 font-semibold opacity-0"
                    style={during(s.from, next)}
                  >
                    {s.text}…
                  </span>
                  {next !== undefined && (
                    <span
                      className="col-start-1 row-start-1 opacity-0"
                      style={show(next)}
                    >
                      {s.text}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <div
          aria-hidden="true"
          className="relative h-1.5 overflow-hidden rounded-[3px] bg-sand"
        >
          <div className="absolute inset-y-0 left-0 w-2/5 animate-[bar-sweep_1.6s_ease-in-out_infinite] rounded-[3px] bg-green" />
        </div>
        <p className="relative grid min-h-[1.25rem] text-center text-xs text-ink-muted desk:text-left">
          <span className="col-start-1 row-start-1" style={hide(SLOW_AFTER)}>
            Dishes we&apos;ve seen before are instant.
          </span>
          <span
            className="col-start-1 row-start-1 opacity-0"
            style={show(SLOW_AFTER)}
          >
            New dishes take a little longer the first time. Almost there…
          </span>
        </p>
      </div>
    </section>
  );
}
