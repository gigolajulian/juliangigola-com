import type { Metadata } from "next";
import { V3Commission } from "@/components/v3/inquire";

export const metadata: Metadata = {
  title: "Commissions",
  description: "Campaigns, editorial, cover art and presskits. Three short steps, and I come back with an approach and a quote.",
  alternates: { canonical: "/contact/form" },
};

export default function CommissionPage() {
  return <V3Commission />;
}
