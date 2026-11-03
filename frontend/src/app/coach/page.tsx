import { ComingSoon } from "@/components/ComingSoon";

// Coach (design/screens/Coach.dc.html) is a later phase; the page exists so the nav has somewhere to go.
export default function CoachPage() {
  return (
    <ComingSoon eyebrow="Coach" lead="Ideas for" accent="your next bite">
      Suggestions for what to eat next, based on how much room you have left today, are coming soon.
    </ComingSoon>
  );
}
