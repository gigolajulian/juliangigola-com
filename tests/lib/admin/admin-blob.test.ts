import { afterEach, expect, it, vi } from "vitest";
import { adminBlob } from "@/lib/admin/admin-call";

afterEach(() => vi.unstubAllGlobals());

it("sends the given headers and hands back the file", async () => {
  const fetch = vi.fn(async () => new Response("a,b", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const blob = await adminBlob("/api/leads/csv", "Export failed", { "x-admin-key": "k" });
  expect(await blob.text()).toBe("a,b");
  expect(fetch).toHaveBeenCalledWith("/api/leads/csv", { headers: { "x-admin-key": "k" }, cache: "no-store" });
});

it("throws a plain Error with the status, a 401 included", async () => {
  vi.stubGlobal("fetch", async () => new Response("no", { status: 401 }));
  const e = await adminBlob("/api/contract?copy=c1", "Download failed", {}).catch((x: unknown) => x);
  expect(e).toBeInstanceOf(Error);
  expect(e).toMatchObject({ message: "Download failed (401)" });
  expect(e).not.toHaveProperty("status");
});
