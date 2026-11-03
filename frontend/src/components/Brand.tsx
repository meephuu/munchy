import Image from "next/image";

/** Bowl + "Munchy" wordmark + tagline, as at the top of the design's Get started screen. */
export function Brand() {
  return (
    <div className="flex items-center gap-3.5 pt-2">
      <Image src="/bowl.png" alt="Ramen bowl illustration" width={96} height={96} className="shrink-0" priority />
      <div className="flex flex-col gap-1">
        <span className="font-display text-[36px] leading-none text-olive-logo">Munchy</span>
        <span className="text-sm text-ink-muted">Your Bite Buddy</span>
      </div>
    </div>
  );
}
