"use client";

import { useSyncExternalStore } from "react";
import { Title } from "@/components/Type";
import { greetingPart } from "@/lib/meals";

// "Good evening, what did you munch?" The part of the day is the person's own, so it is read in the
// browser; the server renders a neutral "Hello" first.
const noSubscribe = () => () => {};
const browserGreeting = () => `Good ${greetingPart(new Date())},`;
const serverGreeting = () => "Hello,";

export function Greeting() {
  const lead = useSyncExternalStore(noSubscribe, browserGreeting, serverGreeting);
  return <Title lead={lead} accent="what did you munch?" stacked className="text-[26px]" />;
}
