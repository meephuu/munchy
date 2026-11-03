import Image from "next/image";
import { Eyebrow, Wordmark } from "@/components/Type";

/** Bowl + "Munchy" wordmark + tagline, as at the top of the Get started screen. */
export function Brand() {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Image src="/bowl.png" alt="Ramen bowl illustration" width={64} height={64} className="shrink-0" priority />
      <div className="flex flex-col gap-1">
        <Wordmark className="text-[30px]" />
        <Eyebrow>Your Bite Buddy</Eyebrow>
      </div>
    </div>
  );
}
