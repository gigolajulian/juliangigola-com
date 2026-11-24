import type { Metadata } from "next";
import { Home } from "@/components/home/home";
import { HOME_DATA } from "@/lib/home/server";
import { shareOg } from "@/lib/og/share";

export const metadata: Metadata = shareOg("Photographer and creative director","Fashion editorial, campaigns and portraits in the San Francisco Bay Area. Available worldwide.");

/* The homepage: the v4 home (`Home`, components/home/home.tsx). */
export default function HomePage() {
  return <Home data={HOME_DATA} />;
}
