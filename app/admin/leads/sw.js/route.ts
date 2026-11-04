/* ── the Leads app's service worker ───────────────────────────────
 * Shows a push as a notification and opens the desk when it is tapped.
 * Served from a route, not public/, so it can carry
 * Service-Worker-Allowed: its scope is /admin/leads, which a script at
 * /admin/leads/sw.js could not otherwise claim (no trailing slash).
 * ─────────────────────────────────────────────────────────────── */

const SW = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = { title: "Leads", body: "Something new on the desk." };
  try { if (e.data) d = e.data.json(); } catch {}
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    tag: d.tag,
    icon: "/leads-app/icon-192.png",
    data: { url: d.url || "/admin/leads" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/admin/leads";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
    const open = all.find((w) => new URL(w.url).pathname.startsWith("/admin/leads"));
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-cache",
      "service-worker-allowed": "/admin/leads",
    },
  });
}
