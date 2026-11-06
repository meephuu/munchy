"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarsIcon,
  ChatIcon,
  HomeIcon,
  PlusIcon,
  UserIcon,
} from "@/components/Icons";
import { Eyebrow, Wordmark } from "@/components/Type";
import type { MemberShell } from "@/lib/shell";

// The logged-in shell from 1024 px wide (design/DESIGN.md, "Desktop layout (V3)"): a white 240 px panel, 20 px from
// the window edge, sticky so it stays put while the main column scrolls. It stands in for the bottom nav.

const ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/home", label: "Home", icon: <HomeIcon size={22} /> },
  { href: "/coach", label: "Coach", icon: <ChatIcon size={22} /> },
  { href: "/progress", label: "Progress", icon: <BarsIcon size={22} /> },
  { href: "/account", label: "Me", icon: <UserIcon size={22} /> },
];

export function Sidebar({ shell }: { shell: MemberShell }) {
  const path = usePathname();
  const initial = (shell.email ?? "?").charAt(0).toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 py-5 pl-5 desk:block">
      <div className="flex h-full flex-col gap-6 rounded-[22px] bg-surface px-4 py-6 shadow-card">
        <Link href="/home" className="flex flex-col gap-1.5 px-2">
          <Wordmark className="h-[26px] self-start" />
          <Eyebrow>Your Bite Buddy</Eyebrow>
        </Link>

        <Link
          href="/add"
          className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-green text-[15px] font-semibold text-bg hover:bg-green-dark"
        >
          <PlusIcon size={20} strokeWidth={2.4} />
          Log a dish
        </Link>

        <nav aria-label="Main" className="flex flex-col gap-1">
          {ITEMS.map(({ href, label, icon }) => {
            const current = path === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-field px-3.5 text-[15px] ${
                  current
                    ? "bg-green-tint font-semibold text-green"
                    : "font-medium text-ink-muted hover:bg-bg"
                }`}
              >
                {icon}
                {label}
              </Link>
            );
          })}
        </nav>

        {shell.targetKcal !== null && (
          <div className="mt-auto flex flex-col gap-1.5 rounded-row bg-bg p-3.5">
            <Eyebrow className="text-[9px]">Daily target</Eyebrow>
            <span className="font-brand text-2xl leading-none text-green">
              {shell.targetKcal.toLocaleString("en-US")}
              <span className="font-sans text-xs font-semibold text-ink">
                {" "}
                kcal
              </span>
            </span>
            {shell.targetLine && (
              <span className="text-xs text-ink-muted">{shell.targetLine}</span>
            )}
          </div>
        )}

        <Link
          href="/account"
          className={`flex items-center gap-2.5 px-1 text-ink ${shell.targetKcal === null ? "mt-auto" : ""}`}
        >
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green font-heading text-base font-semibold text-bg"
          >
            {initial}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-semibold">
              {shell.email ?? "Your account"}
            </span>
            <span className="font-mono text-[9px] tracking-[1px] text-ink-muted uppercase">
              Member
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
