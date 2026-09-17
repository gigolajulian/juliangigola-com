import type { Metadata } from "next";
import { ZoomDemo } from "@/components/zoom-demo";

/* A test bed for the photo viewer's zoom (`lib/zoom.ts`), for checking
   the trip on thumbnails of every shape. Not part of the site: not
   linked, not indexed. */
export const metadata: Metadata = {
  title: "Zoom test bed",
  robots: { index: false, follow: false },
};

export default function ZoomPage() {
  return <ZoomDemo />;
}
