import { describe, expect, it } from "vitest";
// Relative imports: the coverage scanner resolves `@/` under src/, which this repo does not have.
import { GET } from "../../../app/admin/leads/manifest.webmanifest/route";

/* The Leads app's manifest: the whole origin on leads.juliangigola.com,
   /admin/leads on the main site, never indexed. */

const manifest = async (host: string) => {
  const res = GET(new Request("https://x/admin/leads/manifest.webmanifest", { headers: { host } }));
  return { res, body: await res.json() };
};

describe("leads manifest", () => {
  it("scopes the app to the whole origin on the leads subdomain", async () => {
    const { body } = await manifest("leads.juliangigola.com");
    expect(body).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone", name: "LEADS" });
  });

  it("stays under /admin/leads on the main site", async () => {
    const { body } = await manifest("juliangigola.com");
    expect(body).toMatchObject({ id: "/admin/leads", start_url: "/admin/leads", scope: "/admin/leads" });
  });

  it("answers as a manifest, noindex, with a maskable icon", async () => {
    const { res, body } = await manifest("juliangigola.com");
    expect(res.headers.get("content-type")).toBe("application/manifest+json");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(body.icons.map((i: { purpose: string }) => i.purpose)).toContain("maskable");
  });
});
