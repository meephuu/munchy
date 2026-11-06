"use client";

import { useSyncExternalStore } from "react";
import { Eyebrow, Title } from "@/components/Type";
import { dayLabel, greetingPart } from "@/lib/meals";

// "Good evening, what did you munch?" The part of the day is the person's own, so it is read in the
// browser; the server renders a neutral "Hello" first. On desktop the day sits above the title.
const noSubscribe = () => () => {};
const browserGreeting = () => `Good ${greetingPart(new Date())},`;
const serverGreeting = () => "Hello,";
const browserDay = () => dayLabel(new Date());
const serverDay = () => "";

export function Greeting() {
  const lead = useSyncExternalStore(
    noSubscribe,
    browserGreeting,
    serverGreeting,
  );
  const day = useSyncExternalStore(noSubscribe, browserDay, serverDay);
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow className="hidden desk:block">{day || "\u00a0"}</Eyebrow>
      <Title
        lead={lead}
        accent="what did you munch?"
        stacked
        className="text-[26px] desk:text-[34px]"
      />
    </div>
  );
}
