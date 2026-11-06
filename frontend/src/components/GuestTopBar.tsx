import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow, Wordmark } from "@/components/Type";

/** The guest shell's top bar from 1024 px wide (design/DESIGN.md, "Desktop layout (V3)"): the logo and tagline on the
 *  left; on the right any `children` (the guest dish page puts a compact dish search here), then "Log in" and
 *  "Create free account". Hidden on phones, where each screen has its own header. */
export function GuestTopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="mx-auto hidden w-full max-w-[1240px] flex-wrap items-center justify-between gap-4 px-10 py-6 desk:flex">
      <Link href="/" className="flex flex-col gap-1">
        <Wordmark className="h-7 self-start" />
        <Eyebrow>Your Bite Buddy</Eyebrow>
      </Link>
      <div className="flex items-center gap-3">
        {children}
        <Link
          href="/login"
          className="flex h-11 items-center rounded-full border-[1.5px] border-green px-5 text-sm font-semibold hover:bg-green-tint"
        >
          Log in
        </Link>
        <Link
          href="/onboarding"
          className="flex h-11 items-center rounded-full bg-green px-5 text-sm font-semibold text-bg hover:bg-green-dark"
        >
          Create free account
        </Link>
      </div>
    </header>
  );
}
