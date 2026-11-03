import type { MetadataRoute } from "next";

// Makes Munchy installable ("Add to home screen"). Colors are the design's cream; the maskable
// icon keeps the bowl inside the safe zone so phones can crop it to a circle or squircle.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Munchy — Your Bite Buddy",
    short_name: "Munchy",
    description: "Type any dish and get calories & nutrients in seconds.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F2F3D3",
    theme_color: "#F2F3D3",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
