"use client";

import { useEffect, useRef, useState } from "react";

const n0 = (n: number) => n.toLocaleString("en-US");

/** A number that counts up from 0 when it first shows (about 0.9 s, quick at the start and slowing down), and glides
 *  to the new value when it changes later (a dish whose amounts were edited). It is 0 until the page's scripts run, so
 *  the server's HTML and the first client render agree. */
export function CountUp({
  value,
  format = n0,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(0);
  const current = useRef(0); // what is on screen now, so a change starts from there

  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const duration = from === 0 ? 900 : 350;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      current.current = Math.round(from + (value - from) * eased);
      setShown(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{format(shown)}</>;
}
