import { describe, expect, it } from "vitest";
import { GET } from "@/app/admin/leads/manifest.webmanifest/route";

/* leads.juliangigola.com installs as its own app at "/"; the main site keeps /admin/leads. */
describe("the Leads manifest", () => {
  it("scopes the app to the whole leads origin, and to /admin/leads elsewhere", async () => {
    const at = async (host: string) => (await GET(new Request("https://x/admin/leads/manifest.webmanifest", { headers: { host } }))).json();
    expect(await at("leads.juliangigola.com")).toMatchObject({ id: "/", start_url: "/", scope: "/" });
    expect(await at("juliangigola.com")).toMatchObject({ id: "/admin/leads", start_url: "/admin/leads", scope: "/admin/leads" });
  });
});
