import type { ReactNode } from "react";

/**
 * One phone screen: the design frame is 390 wide with 20px side padding. The width and the
 * phone frame on big screens come from .app-shell (layout.tsx, globals.css); this fills it.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh w-full flex-col px-5 pt-5 pb-5 frame:min-h-full">
      {children}
    </main>
  );
}
