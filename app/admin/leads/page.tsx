import type { Metadata, Viewport } from "next";
import { AdminLeads } from "@/components/admin-leads";

/* ── the lead desk, on its own ────────────────────────────────────
 * Julian (2026-11-03): "a different section, hidden from all seo". The
 * same desk as the Leads tab in /admin, with no editor around it, so it
 * opens straight to the list and is what the installed app starts on.
 * Installable on its own (desktop Chrome, iPhone "Add to Home Screen"):
 * the manifest and icons in public/leads-app are linked from here only.
 * Out of the index three ways: this meta, the X-Robots-Tag header
 * (next.config.ts) and robots.txt's /admin rule. Nothing links here.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  manifest: "/leads-app/manifest.webmanifest",
  icons: { apple: "/leads-app/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Leads", statusBarStyle: "black-translucent" },
  // Next writes only `mobile-web-app-capable`; older iOS reads the Apple name.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function LeadsPage() {
  return (
    // `data-workbench`: no site footer; `data-lead-app`: no site header either,
    // and the top clears the iPhone's status bar (`app/styles/admin.css`).
    <div data-workbench data-lead-app className="w-full px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-10">
      <AdminLeads />
    </div>
  );
}
