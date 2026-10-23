import type { Metadata } from "next";
import { V3About } from "@/components/v3/about";

export const metadata: Metadata = {
  title: "About",
  description:
    "Julian Gigola photographs people, mostly for fashion, music and brands, and covers headshots, portraits, graduations and weddings across San Francisco, San Jose and the Bay Area.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return <V3About />;
}
