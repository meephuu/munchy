import type { ReactNode } from "react";

/**
 * One phone-sized column. The design frame is 390 wide with 20px side padding; on wider
 * screens the same column is centered at a max width of 480px.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pt-5 pb-5">
      {children}
    </main>
  );
}
