// The loading mascot: the Munchy "M" wiggling, then eaten bite by bite (with crumbs flying) until nothing is left; then it
// pops back and starts over, for as long as the page is loading.
//
// It is pure SVG + CSS keyframes with no JavaScript, on purpose: the dish page shows it while the server is still working
// out the estimate, and React does not hydrate (run the scripts of) a page part that is still loading, so a timer-driven
// animation would stand still. The keyframes are generated below, one set per bite, so each bite and its crumbs happen at
// their own moment of one long loop.

const M_PATH =
  "M43 214H457L524 504L588 214H979V796H680V472L603 796H404L327 474V796H43Z";

// Each bite is a big circle with two smaller ones for the teeth, on its side facing down-left (the way the eating goes).
// They start at the top-right corner and work across and down, each next to what is already gone, until the whole M is
// taken (checked by sampling every point of the letter against the circles).
const BITES = [
  { x: 962, y: 260, r: 230 },
  { x: 722, y: 260, r: 230 },
  { x: 962, y: 560, r: 230 },
  { x: 482, y: 290, r: 230 },
  { x: 722, y: 560, r: 230 },
  { x: 962, y: 800, r: 200 },
  { x: 242, y: 290, r: 230 },
  { x: 482, y: 580, r: 230 },
  { x: 722, y: 800, r: 220 },
  { x: 32, y: 300, r: 230 },
  { x: 242, y: 600, r: 230 },
  { x: 482, y: 800, r: 220 },
  { x: 32, y: 640, r: 230 },
  { x: 242, y: 810, r: 220 },
  { x: 32, y: 800, r: 200 },
];

const EAT_DIRECTION = (3 * Math.PI) / 4; // down and to the left

/** The circles of one bite: the big one and two teeth on its leading (down-left) side. */
function biteCircles({ x, y, r }: (typeof BITES)[number]) {
  const a = EAT_DIRECTION;
  const teeth = [-1, 1].map((s) => {
    const t = a + (s * Math.PI) / 2;
    return {
      x: x + Math.cos(t) * r * 0.85 + Math.cos(a) * r * 0.55,
      y: y + Math.sin(t) * r * 0.85 + Math.sin(a) * r * 0.55,
      r: r * 0.5,
    };
  });
  return [{ x, y, r }, ...teeth];
}

// where each crumb of a bite goes (user units of the 1024 box): sideways, then down
const CRUMBS = [
  { dx: -45, dy: 80, rot: -200, size: 34 },
  { dx: 35, dy: 90, rot: 160, size: 28 },
];

const TICK = 0.4; // seconds between bites
const HOLD = 2; // ticks of the whole letter, wiggling, before the first bite
const END = 0; // ticks with nothing left, before it pops back (none: it pops as soon as the last bite lands)
const LOOP = (HOLD + BITES.length + END) * TICK; // seconds for one whole eating
const pct = (seconds: number) => `${((seconds / LOOP) * 100).toFixed(2)}%`;
const biteAt = (i: number) => (HOLD + i) * TICK;

/** All the keyframes and rules, as one stylesheet. */
function css(): string {
  const out: string[] = [
    ".mb-wig{transform-box:fill-box;transform-origin:50% 100%;animation:mb-wiggle .62s ease-in-out infinite}",
    `.mb-pop{transform-box:fill-box;transform-origin:50% 100%;animation:mb-pop ${LOOP}s linear infinite}`,
    `.mb-jolt{transform-box:fill-box;transform-origin:50% 50%;animation:mb-jolt ${LOOP}s linear infinite}`,
    ".mb-hole{transform-box:fill-box;transform-origin:50% 50%;transform:scale(0)}",
    ".mb-crumb{transform-box:fill-box;transform-origin:50% 50%;opacity:0}",
    "@keyframes mb-wiggle{0%,100%{transform:rotate(-4deg) scale(1.02,.97)}50%{transform:rotate(4deg) scale(.98,1.03)}}",
    `@keyframes mb-pop{0%{opacity:0;transform:scale(0)}${pct(0.03)}{opacity:1}${pct(0.14)}{transform:scale(1.28,.9)}${pct(0.23)}{transform:scale(.88,1.1)}${pct(0.32)}{transform:scale(1.06,.97)}${pct(0.42)}{transform:scale(1)}100%{opacity:1;transform:scale(1)}}`,
  ];

  // the jolt of each bite: a quick squash to the side and back
  const jolt = BITES.map((_, i) => {
    const t = biteAt(i);
    return `${pct(t)}{transform:translate(0,0) scale(1)}${pct(t + 0.07)}{transform:translate(-14px,6px) scale(.94,1.04)}${pct(t + 0.2)}{transform:translate(0,0) scale(1)}`;
  }).join("");
  out.push(`@keyframes mb-jolt{0%{transform:none}${jolt}100%{transform:none}}`);

  BITES.forEach((b, i) => {
    const t = biteAt(i);
    // the bite itself: its circles grow from nothing (with a little overshoot) at its moment and stay until the loop restarts
    out.push(
      `@keyframes mb-hole-${i}{0%,${pct(t)}{transform:scale(0)}${pct(t + 0.14)}{transform:scale(1.06)}${pct(t + 0.2)}{transform:scale(1)}100%{transform:scale(1)}}`,
    );
    out.push(`.mb-hole-${i}{animation:mb-hole-${i} ${LOOP}s linear infinite}`);
    // its crumbs: pop out, rise a little, then fall and fade
    out.push(
      `@keyframes mb-crumb-${i}{0%,${pct(t)}{opacity:0;transform:translate(0,0) rotate(0)}${pct(t + 0.02)}{opacity:1;transform:translate(0,0) rotate(0)}${pct(t + 0.14)}{opacity:1;transform:translate(calc(var(--dx)*.5),-28px) rotate(calc(var(--rot)*.3))}${pct(t + 0.5)}{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(var(--rot))}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(var(--rot))}}`,
    );
    out.push(`.mb-crumb-${i}{animation:mb-crumb-${i} ${LOOP}s linear infinite}`);
    void b;
  });
  // With "reduce motion" on the letter still gets eaten (a few bites in place are gentle), but the wiggle is much smaller,
  // and the jolts are dropped (the pop-in stays).
  out.push(
    "@keyframes mb-wiggle-soft{0%,100%{transform:rotate(-1.5deg)}50%{transform:rotate(1.5deg)}}",
    "@media (prefers-reduced-motion:reduce){.mb-wig{animation:mb-wiggle-soft 1.2s ease-in-out infinite}.mb-jolt{animation:none}}",
  );
  return out.join("");
}

const STYLES = css();

export function BitingLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      aria-hidden="true"
      className={`overflow-visible ${className}`}
    >
      <style>{STYLES}</style>
      <defs>
        <mask
          id="munchy-bite-mask"
          maskUnits="userSpaceOnUse"
          x="-200"
          y="-200"
          width="1424"
          height="1424"
        >
          <rect x="-200" y="-200" width="1424" height="1424" fill="white" />
          {BITES.map((b, i) =>
            biteCircles(b).map((c, j) => (
              <circle
                key={`${i}-${j}`}
                className={`mb-hole mb-hole-${i}`}
                cx={c.x}
                cy={c.y}
                r={c.r}
                fill="black"
              />
            )),
          )}
        </mask>
      </defs>

      <g className="mb-pop">
        <g className="mb-wig">
          <g className="mb-jolt">
            <path
              d={M_PATH}
              fill="var(--color-green)"
              mask="url(#munchy-bite-mask)"
            />
          </g>
        </g>
      </g>

      {BITES.map((b, i) => {
        // crumbs start from the leading edge of the bite
        // (kept inside the letter's box, so the crumbs of the edge bites do not start outside it)
        const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
        const sx = clamp(b.x + Math.cos(EAT_DIRECTION) * b.r * 0.9, 100, 920);
        const sy = clamp(b.y + Math.sin(EAT_DIRECTION) * b.r * 0.9, 260, 720);
        return CRUMBS.map((c, j) => (
          <rect
            key={`${i}-${j}`}
            className={`mb-crumb mb-crumb-${i}`}
            x={sx - c.size / 2}
            y={sy - c.size / 2}
            width={c.size}
            height={c.size}
            rx={c.size * 0.3}
            fill="var(--color-green)"
            style={
              {
                "--dx": `${c.dx}px`,
                "--dy": `${c.dy}px`,
                "--rot": `${c.rot}deg`,
                animationDelay: `${j * 0.03}s`,
              } as React.CSSProperties
            }
          />
        ));
      })}
    </svg>
  );
}
