import type { Metadata, Viewport } from "next";
import { AdminLeads } from "@/components/admin/admin-leads";
import { LeadCalendar } from "@/components/leads/lead-calendar";
import { startupImages } from "@/lib/leads-startup";

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
  title: "LEADS",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  manifest: "/admin/leads/manifest.webmanifest",
  // The app's own tile, not the site's black JG, in the desktop window and tab.
  icons: { icon: [{ url: "/leads-app/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/leads-app/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "LEADS", statusBarStyle: "black-translucent", startupImage: startupImages },
  // Next writes only `mobile-web-app-capable`; older iOS reads the Apple name.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// `?calendar`: the Calendar on its own, until the desk's navigation (leads-nav) mounts it.
export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  const calendar = (await searchParams).calendar !== undefined;
  return (
    // `data-workbench`: no site footer; `data-lead-app`: no site header either,
    // and the top clears the iPhone status bar plus the blur iOS lays under it.
    <div data-workbench data-lead-app className="w-full px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] max-lg:pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-10">
      {calendar ? <LeadCalendar /> : <AdminLeads />}
    </div>
  );
}
