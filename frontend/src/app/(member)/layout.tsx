import { Suspense, type ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { memberInfo } from "@/lib/supabase/session";

// Home, Coach, Progress, Me and Log a dish share this layout, so the sidebar (desktop) is rendered once and stays put
// while only the page beside it changes. Without it each page drew its own sidebar and it vanished and came back on
// every click. A layout is not rendered again when moving between its pages.
export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div className="contents desk:flex desk:min-h-dvh desk:flex-row">
      <Suspense fallback={<Sidebar shell={null} />}>
        <MemberSidebar />
      </Suspense>
      {children}
    </div>
  );
}

async function MemberSidebar() {
  return <Sidebar shell={await memberInfo()} />;
}
