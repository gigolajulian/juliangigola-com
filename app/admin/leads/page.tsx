import type { Metadata, Viewport } from "next";
import { AdminLeads } from "@/components/admin-leads";

/* ── the lead desk, on its own ────────────────────────────────────
 * Julian (2026-11-03): "a different section, hidden from all seo". The
 * same desk as the Leads tab in /admin, with no editor around it, so it
 * opens straight to the list and is what the installed app starts on.
 * Out of the index three ways: this meta, the X-Robots-Tag header
 * (next.config.ts) and robots.txt's /admin rule. Nothing links here.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function LeadsPage() {
  return (
    // `data-workbench`: no site footer here (`app/styles/admin.css`).
    <div data-workbench className="w-full px-4 pb-16 pt-20 sm:px-10">
      <AdminLeads />
    </div>
  );
}
