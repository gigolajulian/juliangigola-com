import { afterEach, expect, it, vi } from "vitest";
import { AdminError, adminBlob, isLocked } from "@/lib/admin/admin-call";
import { statusOf } from "@/lib/http";

afterEach(() => vi.unstubAllGlobals());

it("sends the given headers and hands back the file", async () => {
  const fetch = vi.fn(async () => new Response("a,b", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const blob = await adminBlob("/api/leads/csv", "Export failed", { "x-admin-key": "k" });
  expect(await blob.text()).toBe("a,b");
  expect(fetch).toHaveBeenCalledWith("/api/leads/csv", { headers: { "x-admin-key": "k" }, cache: "no-store" });
});

it("throws an AdminError with the gate's words on a 401, so the desk reads it as signed out", async () => {
  vi.stubGlobal("fetch", async () => Response.json({ error: "Not authorized." }, { status: 401 }));
  const e = await adminBlob("/api/contract?copy=c1", "Download failed", {}).catch((x: unknown) => x);
  expect(e).toBeInstanceOf(AdminError);
  expect(e).toMatchObject({ message: "Not authorized.", status: 401 });
  expect(isLocked(e)).toBe(true);
  expect(statusOf(e)).toBe(401);
});

it("names the download and the status for any other failure", async () => {
  vi.stubGlobal("fetch", async () => new Response("<html>", { status: 502 }));
  const e = await adminBlob("/api/leads/csv", "Export failed", {}).catch((x: unknown) => x);
  expect(e).toBeInstanceOf(AdminError);
  expect(e).toMatchObject({ message: "Export failed (502)", status: 502 });
  expect(isLocked(e)).toBe(false);
});

it("falls back to the status when a 401 is not JSON", async () => {
  vi.stubGlobal("fetch", async () => new Response("no", { status: 401 }));
  const e = await adminBlob("/api/contract?copy=c1", "Download failed", {}).catch((x: unknown) => x);
  expect(e).toMatchObject({ message: "Download failed (401)", status: 401 });
  expect(isLocked(e)).toBe(true);
});
