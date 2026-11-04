import Image from "next/image";
import type { ElementType, ReactNode } from "react";

const TONES = { bronze: "text-bronze", muted: "text-ink-muted", terracotta: "text-terracotta-text" };

/** Small uppercase mono label above things ("ESTIMATED", "TODAY · SUN 1 NOV", "TWEAK IT"). */
export function Eyebrow({
  tone = "bronze",
  as: Tag = "span",
  className = "",
  children,
}: {
  tone?: "bronze" | "muted" | "terracotta";
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={`font-mono text-[10px] font-bold tracking-[1.5px] uppercase ${TONES[tone]} ${className}`}
    >
      {children}
    </Tag>
  );
}

/** A heading in Fraunces; the second half is italic green ("What's on your plate, *and what's in it?*").
 *  Size comes from `className` (page title 26-28, card title 18-20). */
export function Title({
  lead,
  accent,
  as: Tag = "h1",
  className = "",
}: {
  lead?: string;
  accent?: string;
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag className={`font-heading font-semibold leading-[1.15] text-ink ${className}`}>
      {lead}
      {lead && accent ? " " : ""}
      {accent && <span className="text-green italic">{accent}</span>}
    </Tag>
  );
}

/** The "Munchy" logo (public/logo/logo-text.png, 6.3:1). Size it with the height class, e.g. "h-6". */
export function Wordmark({ className = "h-6" }: { className?: string }) {
  return <Image src="/logo/logo-text.png" alt="Munchy" width={1200} height={191} priority className={`w-auto ${className}`} />;
}
