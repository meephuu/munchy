import { ComingSoon } from "@/components/ComingSoon";

// Progress (design/screens/Progress.dc.html) is a later phase; the page exists so the nav has somewhere to go.
export default function ProgressPage() {
  return (
    <ComingSoon eyebrow="Progress" lead="Your week," accent="at a glance">
      Your weekly calories against your target, your streak and your weight trend are coming soon.
    </ComingSoon>
  );
}
