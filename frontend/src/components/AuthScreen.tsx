import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CheckIcon } from "@/components/Icons";
import { Eyebrow } from "@/components/Type";

const POINTS = [
  "Any dish, Thai or English",
  "Your week, streak and weight",
  "Ideas for what fits next",
];

/**
 * The log-in and sign-up screens. A phone shows the form on the cream screen as before. From 1024 px wide it is a split
 * screen (design/screens/desktop/Login.dc.html): a green brand panel on the left (cream logo, a short pitch, the bowl)
 * and the form, at most 420 px wide, centered on the right.
 */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="contents desk:flex desk:min-h-dvh">
      <aside className="relative m-5 hidden min-w-0 flex-[1_1_480px] flex-col gap-7 overflow-hidden rounded-[28px] bg-green p-12 text-bg desk:flex">
        <Link href="/" className="flex flex-col gap-1.5">
          <Image
            src="/logo/logo-text-cream.png"
            alt="Munchy"
            width={1200}
            height={192}
            priority
            className="h-[30px] w-auto self-start"
          />
          <Eyebrow className="text-gold">Your Bite Buddy</Eyebrow>
        </Link>
        <h2 className="max-w-[460px] font-heading text-[44px] leading-[1.12] font-semibold text-bg">
          Know what&apos;s in every bite,{" "}
          <span className="text-gold italic">without the guesswork.</span>
        </h2>
        <ul className="flex flex-col gap-3 text-[15px] text-green-soft">
          {POINTS.map((p) => (
            <li key={p} className="flex items-center gap-2.5">
              <CheckIcon size={18} className="shrink-0 text-gold" />
              {p}
            </li>
          ))}
        </ul>
        <Image
          src="/bowl.png"
          alt=""
          width={260}
          height={260}
          className="mt-auto self-end"
        />
      </aside>

      <main className="flex min-h-dvh w-full flex-col px-5 pt-5 pb-5 frame:min-h-full desk:min-h-0 desk:min-w-0 desk:flex-[1_1_440px] desk:items-center desk:justify-center desk:px-10 desk:py-12">
        <div className="flex flex-1 flex-col desk:w-full desk:max-w-[420px] desk:flex-none">
          {children}
        </div>
      </main>
    </div>
  );
}
