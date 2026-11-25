import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CircuitOpen, outbound } from "@/lib/net";

/* NET-1: every outbound call has a timeout, retries safe calls with backoff and jitter, and stops after repeated failures. */

const calls: { url: string; init: RequestInit }[] = [];
const stub = (answer: (n: number, init: RequestInit) => Promise<Response>) =>
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => (calls.push({ url, init }), answer(calls.length, init)));
beforeEach(() => (calls.length = 0));
afterEach(() => vi.unstubAllGlobals());

describe("outbound", () => {
  it("times out a call that never answers", async () => {
    stub((_, init) => new Promise((_, no) => init.signal!.addEventListener("abort", () => no(init.signal!.reason))));
    await expect(outbound("https://slow.example/x", { method: "POST", timeoutMs: 20 })).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it("retries a GET on a 5xx or a network error, then answers", async () => {
    stub(async (n) =>
      n === 1 ? new Response("", { status: 503 }) : n === 2 ? Promise.reject(new TypeError("reset")) : new Response("ok"),
    );
    expect(await (await outbound("https://flaky.example/x")).text()).toBe("ok");
    expect(calls).toHaveLength(3);
  });

  it("never repeats a write without an idempotency key, and repeats one with it", async () => {
    stub(async () => new Response("", { status: 500 }));
    expect((await outbound("https://w1.example/x", { method: "POST" })).status).toBe(500);
    expect(calls).toHaveLength(1);
    expect((await outbound("https://w2.example/x", { method: "POST", retry: true })).status).toBe(500);
    expect(calls).toHaveLength(4);
  });

  it("stops calling a host after five failures in a row", async () => {
    stub(async () => new Response("", { status: 502 }));
    for (let i = 0; i < 5; i++) await outbound("https://down.example/x", { method: "POST" });
    await expect(outbound("https://down.example/y")).rejects.toBeInstanceOf(CircuitOpen);
    expect(calls).toHaveLength(5);
    stub(async () => new Response("ok"));
    expect((await outbound("https://up.example/x")).status).toBe(200);
  });
});

describe("every server call to another service", () => {
  /** Browser code and Cloudflare bindings, not outbound calls. */
  const EXEMPT = [
    "lib/net.ts",
    "lib/http.ts",
    "lib/admin/admin-call.ts",
    "lib/leads/invoice-pdf.ts",
    "app/admin/leads/sw.js/route.ts",
    // Run by bare node (scripts/check-videos.mjs); an admin-only title lookup with its own 8 s timeout.
    "lib/work/videos.ts",
  ];
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p.split("\\").join("/")] : [];
    });
  it("goes through outbound", () => {
    const bare = ["lib", "app", "worker"]
      .flatMap(files)
      .filter((f) => !EXEMPT.includes(f) && !readFileSync(f, "utf8").startsWith('"use client"'))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .map((l, i) => [f, i + 1, l] as const),
      )
      .filter(([, , l]) => /(^|[^.\w])fetch\(/.test(l) && !/async fetch\(|fetch\(\w+: /.test(l))
      .map(([f, n]) => `${f}:${n}`);
    expect(bare).toEqual([]);
  });
});
