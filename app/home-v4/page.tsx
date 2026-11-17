import type { Metadata } from "next";
import { MtHome } from "@/components/v3/mt/home";
import { MT } from "@/lib/mt-home-data";
import { shareOg } from "@/lib/share";

/* The v4 home from the server, for `/?mtscroll=1` (a rewrite in next.config.ts sends that address here).
   A route of its own so the default home's files stay as they are. Not for search: `/` is the page. */
export const metadata: Metadata = {
  ...shareOg("Photographer and creative director", "Fashion editorial, campaigns and portraits in the San Francisco Bay Area. Available worldwide."),
  robots: { index: false },
  alternates: { canonical: "/" },
};

/* Rendered per request, not pre-built: a pre-built copy carries this route's own address, so the header and anything
   else that asks "is this the home" disagreed with the browser (React 418, the phone layout broke). Only flagged
   visits come here, so only they pay for the render. */
export const dynamic = "force-dynamic";

export default function HomeV4() {
  return <MtHome data={MT} />;
}
