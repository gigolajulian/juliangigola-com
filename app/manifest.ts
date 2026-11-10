import type { MetadataRoute } from "next";

/* Install name, colors and icons for the site. The ground is the dark
   `--background` token, written out because a manifest cannot read CSS. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Julian Gigola",
    short_name: "Julian Gigola",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0a09",
    theme_color: "#0b0a09",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
