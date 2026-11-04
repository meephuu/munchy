"use client";

import { useEffect, useState } from "react";
import { Eyebrow } from "@/components/Type";

// What is happening while a dish is worked out. A dish seen before is instant; a new one needs the language
// model twice (read it, then look up what is usually in it) and can take 30 seconds, so the wait says so.
const STEPS: { from: number; text: string }[] = [
  { from: 0, text: "Reading your dish…" },
  { from: 4, text: "Finding what's usually in it…" },
  { from: 12, text: "Adding it up…" },
  {
    from: 25,
    text: "New dishes take a little longer the first time. Almost there…",
  },
];

export function LoadingSteps() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const step = [...STEPS].reverse().find((s) => seconds >= s.from) ?? STEPS[0];
  return <Eyebrow tone="muted">{step.text}</Eyebrow>;
}
