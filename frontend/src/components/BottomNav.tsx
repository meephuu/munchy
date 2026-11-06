"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BarsIcon, ChatIcon, HomeIcon, PlusIcon, UserIcon } from "@/components/Icons";

// Floating white bar for logged-in screens (design/screens/Main.dc.html): Home, Coach, the raised green
// "+" (log a dish), Progress, Me. 68px tall, 12px from the sides of the phone, sticky at the bottom.

const ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/home", label: "Home", icon: <HomeIcon size={22} /> },
  { href: "/coach", label: "Coach", icon: <ChatIcon size={22} /> },
  { href: "/progress", label: "Progress", icon: <BarsIcon size={22} /> },
  { href: "/account", label: "Me", icon: <UserIcon size={22} /> },
];

export function BottomNav() {
  const path = usePathname();

  const item = ({ href, label, icon }: (typeof ITEMS)[number]) => {
    const current = path === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={current ? "page" : undefined}
        className={`flex min-w-[52px] flex-col items-center gap-[3px] text-[10px] ${
          current ? "font-semibold text-green" : "text-ink-muted"
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-4 -mx-2 mt-6 flex h-[68px] desk:hidden items-center justify-around rounded-panel bg-surface shadow-nav"
    >
      {item(ITEMS[0])}
      {item(ITEMS[1])}
      <Link
        href="/add"
        aria-label="Log a dish"
        className="-mt-[26px] flex size-[52px] items-center justify-center rounded-full border-4 border-bg bg-green text-white hover:bg-green-dark"
      >
        <PlusIcon size={24} strokeWidth={2.4} />
      </Link>
      {item(ITEMS[2])}
      {item(ITEMS[3])}
    </nav>
  );
}
