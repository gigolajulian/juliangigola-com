import type { Metadata } from "next";
import { V3Home } from "@/components/v3/home";
import { shareOg } from "@/lib/share";

export const metadata: Metadata = shareOg("Photographer and creative director","Fashion editorial, campaigns and portraits in the San Francisco Bay Area. Available worldwide.");

/* JG V3 homepage (master v39). The old deck (strip, cover float, screens)
   is retired; its components are left in place, unused. */
export default function Home() {
  return <V3Home />;
}
