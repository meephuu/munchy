import type { Metadata, Viewport } from "next";
import { Anuphan, Climate_Crisis, Figtree } from "next/font/google";
import "./globals.css";

// Display font: titles and big numbers (weight 400 only).
const climate = Climate_Crisis({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-climate",
  display: "swap",
});

// Body font, with Anuphan behind it for Thai glyphs (see --font-body in globals.css).
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
  themeColor: "#F2F3D3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${climate.variable} ${figtree.variable} ${anuphan.variable}`}
    >
      <body className="antialiased">
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
