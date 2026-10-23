import type { Metadata } from "next";
import { V3Inquire } from "@/components/v3/inquire";

export const metadata: Metadata = {
  title: "Inquire",
  description: "Start a project or book a consultation. Campaigns, editorial, cover art and presskits, in the San Francisco Bay Area.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <V3Inquire />;
}
