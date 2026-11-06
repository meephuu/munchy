import type { ReactNode } from "react";
import { GuestTopBar } from "@/components/GuestTopBar";
import { Sidebar } from "@/components/Sidebar";
import type { MemberShell } from "@/lib/shell";

export type Shell =
  | { kind: "member"; member: MemberShell }
  | {
      kind: "guest";
      topBar?: ReactNode;
      /** the sign-up screens: "Already have an account?" instead of "Create free account" */ hasAccountHint?: boolean;
    };

/**
 * One screen. On a phone it is the design frame: 390 wide with 20px side padding (the width, and the phone frame on
 * mid-size screens, come from .app-shell in layout.tsx and globals.css). From 1024px wide it becomes the desktop layout
 * (design/DESIGN.md, "Desktop layout (V3)"): a `shell` picks the sidebar for logged-in screens or the top bar for
 * guest screens; without one the content is simply centered in a wide column.
 */
export function Screen({
  children,
  shell,
}: {
  children: ReactNode;
  shell?: Shell;
}) {
  const guest = shell?.kind === "guest";
  return (
    <div
      className={`contents desk:flex desk:min-h-dvh ${guest ? "desk:flex-col" : "desk:flex-row"}`}
    >
      {shell?.kind === "member" && <Sidebar shell={shell.member} />}
      {guest && (
        <GuestTopBar hasAccountHint={shell.hasAccountHint}>
          {shell.topBar}
        </GuestTopBar>
      )}
      <main
        className={`flex min-h-dvh w-full flex-col px-5 pt-5 pb-5 frame:min-h-full desk:min-h-0 desk:min-w-0 desk:flex-1 ${
          guest
            ? "desk:mx-auto desk:max-w-[1240px] desk:px-10 desk:pt-6 desk:pb-12"
            : "desk:px-10 desk:pt-9 desk:pb-12"
        }`}
      >
        <div
          className={`flex flex-1 flex-col desk:mx-auto desk:w-full desk:flex-none desk:gap-6 ${guest ? "" : "desk:max-w-[1120px]"}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
