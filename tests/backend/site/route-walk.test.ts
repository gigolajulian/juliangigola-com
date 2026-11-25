import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKV, INBOX_KEY, LEADS_KEY } from "../fakes";

/* Deny by default (BASELINE.md AUTHZ-3): every route under app/api answers 401 to a request with no key, unless it is
   listed below as public on purpose or opened by a link's own token. The list is read from disk, so a new route is
   walked the day it lands; a new public one has to be added here, on purpose. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx));

/** Open to anyone: rate-limited, Stripe-signed, or read-only public data. */
const PUBLIC = new Set(["beacon", "book", "build", "deposit", "deposit/[id]", "slots", "stripe", "weather"]);
/** Opened by a signed link or a gallery or contract token, tested in their own files. */
const BY_LINK = new Set(["booking/[id]", "contract/[id]", "proof/[token]", "proof/[token]/send", "proof/[token]/track", "proof/[token]/unlock"]);

const API = join(process.cwd(), "app", "api");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f === "route.ts" ? [relative(API, dir).replaceAll("\\", "/")] : [];
  });
const ROUTES = walk(API).sort();
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

beforeEach(() => {
  // Every secret set, so a gate answers 401 for the missing key rather than 503 for a missing setup.
  ctx.env = { INBOX: new FakeKV(), INBOX_KEY, LEADS_KEY, WORKER_KEY: "worker-key-for-tests", PROOF_KEY: "p", BOOKING_SECRET: "b" };
  // Nothing past the gate may reach the network on a request without a key.
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch before the gate")));
});
afterEach(() => vi.unstubAllGlobals());

describe("every API route", () => {
  it("is found on disk", () => {
    expect(ROUTES.length).toBeGreaterThan(30);
    for (const r of [...PUBLIC, ...BY_LINK]) expect(ROUTES).toContain(r);
  });

  for (const route of ROUTES.filter((r) => !PUBLIC.has(r) && !BY_LINK.has(r))) {
    it(`/api/${route} refuses every verb without a key`, async () => {
      const mod = (await import(/* @vite-ignore */ join(API, route, "route.ts"))) as Record<string, unknown>;
      const verbs = METHODS.filter((m) => typeof mod[m] === "function");
      expect(verbs.length, `no handler on /api/${route}`).toBeGreaterThan(0);
      for (const m of verbs) {
        const url = `https://juliangigola.com/api/${route.replace(/\[(\w+)\]/g, "x")}`;
        const req = new Request(url, { method: m, ...(m === "GET" || m === "DELETE" ? {} : { body: "{}", headers: { "content-type": "application/json" } }) });
        const res = await (mod[m] as (r: Request, c: unknown) => Promise<Response>)(req, { params: Promise.resolve({ id: "x", token: "x" }) });
        expect([401, 403], `${m} /api/${route} answered ${res.status}`).toContain(res.status);
      }
    });
  }
});
