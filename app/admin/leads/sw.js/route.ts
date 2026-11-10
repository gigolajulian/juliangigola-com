/* ── the Leads app's service worker ───────────────────────────────
 * Shows a push as a notification and opens the desk when it is tapped,
 * keeps the unread count on the app icon, and keeps an offline shell so
 * the installed app opens without a connection.
 * Served from a route, not public/, so it can carry Service-Worker-Allowed:
 * its scope is "/" on leads.juliangigola.com and /admin/leads on the main
 * site, neither of which a script at /admin/leads/sw.js could otherwise claim.
 * ─────────────────────────────────────────────────────────────── */

const SW = (offline: boolean) => `
const SHELL = "leads-shell";
const BADGE = "leads-badge";
const HOME = self.registration.scope;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

/* One more on the icon per push; the desk sets the real count when it opens. */
async function bump() {
  if (!self.navigator.setAppBadge) return;
  const c = await caches.open(BADGE);
  const m = await c.match("n");
  const n = (m ? Number(await m.text()) || 0 : 0) + 1;
  await c.put("n", new Response(String(n)));
  await self.navigator.setAppBadge(n);
}
self.addEventListener("push", (e) => {
  let d = { title: "Leads", body: "Something new on the desk." };
  try { if (e.data) d = e.data.json(); } catch {}
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title, { body: d.body, tag: d.tag, icon: "/leads-app/icon-192.png", badge: "/leads-app/badge-96.png" }),
    bump().catch(() => {}),
  ]));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
    const open = all.find((w) => w.url.startsWith(HOME));
    return open ? open.focus() : self.clients.openWindow(HOME);
  }));
});
${offline ? `
/* Offline shell: the page itself network-first, the build's files
   cache-first (their names change with each build). Never the API, so no
   lead data is stored here.
   shortcut: old builds' files stay in the cache; small, prune if it grows. */
const keep = (req, res) => { if (res.ok) { const c = res.clone(); caches.open(SHELL).then((s) => s.put(req, c)); } return res; };
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  const path = new URL(r.url).pathname;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((res) => keep(HOME, res)).catch(() => caches.match(HOME).then((m) => m || Response.error())));
  } else if (path.startsWith("/_next/static/") || path.startsWith("/leads-app/")) {
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => keep(r, res))));
  }
});` : ""}
`;

export function GET() {
  // No offline cache under `next dev`: its files keep their names while their code changes.
  return new Response(SW(process.env.NODE_ENV !== "development"), {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-cache",
      "service-worker-allowed": "/",
    },
  });
}
