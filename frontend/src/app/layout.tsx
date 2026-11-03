import type { Metadata, Viewport } from "next";
import { Anuphan, Climate_Crisis, Figtree, Fraunces, Space_Mono } from "next/font/google";
import "./globals.css";

// Brand: ONLY the "Munchy" logo and big numbers (weight 400 only).
const climate = Climate_Crisis({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-climate",
  display: "swap",
});

// Headings: Fraunces 600 and its italic. Variable font, so the optical size adapts to the text size.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

// Labels and eyebrows, amounts, times, meta.
const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

// Body and UI, with Anuphan behind it for Thai glyphs (see --font-sans in globals.css).
const figtree = Figtree({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const anuphan = Anuphan({
  weight: ["400", "500"],
  subsets: ["latin", "thai"],
  variable: "--font-anuphan",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Munchy — Your Bite Buddy",
  description: "Type any dish and get calories & nutrients in seconds.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F2EA",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [climate, fraunces, spaceMono, figtree, anuphan].map((f) => f.variable).join(" ");
  return (
    <html lang="en" className={fonts}>
      <body className="antialiased">
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
