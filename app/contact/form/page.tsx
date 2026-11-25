import type { Metadata } from "next";
import { shareOg } from "@/lib/og/share";
import { CommissionForm } from "@/components/contact/inquire";

export const metadata: Metadata = {
  title: "Commissions",
  description: "Campaigns, editorial, cover art and press kits. Three short steps, and I'll reply with an approach and a quote.",
  alternates: { canonical: "/contact/form" },
  ...shareOg(
    "Commissions",
    "Campaigns, editorial, cover art and press kits. Three short steps, and I'll reply with an approach and a quote.",
  ),
};

export default function CommissionPage() {
  return <CommissionForm />;
}
