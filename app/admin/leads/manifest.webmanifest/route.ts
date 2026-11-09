/* The Leads app's manifest. On leads.juliangigola.com the app is the whole
 * origin (scope "/", its own sign-in and storage); on the main site it stays
 * under /admin/leads for the installs made before the subdomain. */

export const dynamic = "force-dynamic";

const ICONS = [
  { src: "/leads-app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/leads-app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/leads-app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export function GET(req: Request) {
  const own = (req.headers.get("host") ?? "").startsWith("leads.");
  const root = own ? "/" : "/admin/leads";
  return Response.json(
    {
      id: root,
      name: "LEADS",
      short_name: "LEADS",
      start_url: root,
      scope: root,
      display: "standalone",
      background_color: "#000000",
      theme_color: "#000000",
      icons: ICONS,
    },
    { headers: { "content-type": "application/manifest+json", "x-robots-tag": "noindex, nofollow" } },
  );
}
