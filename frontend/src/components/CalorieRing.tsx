import Image from "next/image";

const R = 54;
const LENGTH = 2 * Math.PI * R; // 339.3

/** The day's calories as a ring around the bowl: green-to-bronze gradient, terracotta when over target.
 *  `pct` is the whole percent eaten (it can pass 100; the ring just closes). */
export function CalorieRing({
  pct,
  over,
  label,
}: {
  pct: number;
  over: boolean;
  label: string;
}) {
  const filled = Math.max(0, Math.min(100, pct)) / 100;
  return (
    <div className="relative size-[120px] shrink-0 desk:size-[168px]">
      <svg
        role="img"
        aria-label={label}
        viewBox="0 0 120 120"
        className="absolute inset-0 size-full -rotate-90"
      >
        <defs>
          <linearGradient id="munchy-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1D5C3A" />
            <stop offset="1" stopColor="#B7893A" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="#EFE6D6"
          strokeWidth="9"
        />
        {filled > 0 && (
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={over ? "#B5532F" : "url(#munchy-ring)"}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={LENGTH}
            strokeDashoffset={LENGTH * (1 - filled)}
          />
        )}
      </svg>
      <Image
        src="/bowl.png"
        alt=""
        width={88}
        height={88}
        className="absolute inset-[13.4%] size-[73.3%]"
      />
    </div>
  );
}
