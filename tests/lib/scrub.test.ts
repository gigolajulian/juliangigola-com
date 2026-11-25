import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { scrub, scrubConsole } from "@/lib/scrub";

/* PRIV-2: logs carry no personal data or secrets. */

describe("server logs", () => {
  it("mask addresses, phone numbers and keys, and keep dates, ids and statuses", () => {
    expect(scrub("Google 400: maya.r+1@gmail.com is not a guest")).toBe("Google 400: [email] is not a guest");
    for (const phone of ["(408) 555-0134", "408-555-0134", "+1 408 555 0134", "+44 20 7946 0958"])
      expect(scrub(`call ${phone} now`)).toBe("call [phone] now");
    expect(scrub("auth Bearer ghp_abcdefghijklmnopqrstuvwxyz1234 sk_live_51Habc")).toBe("auth [secret] [secret]");
    expect(scrub("booking 11252026-k7m2q9xd at 2026-11-25T18:00:00Z, status 502, pi_3QabcDEF")).toBe(
      "booking 11252026-k7m2q9xd at 2026-11-25T18:00:00Z, status 502, pi_3QabcDEF",
    );
  });

  it("are masked once the console is wrapped, errors included", () => {
    const seen: unknown[][] = [];
    const raw = console.error;
    console.error = (...a: unknown[]) => void seen.push(a);
    try {
      scrubConsole();
      console.error("notion lead", new Error("no row for sam@example.com"), 404);
    } finally {
      console.error = raw;
    }
    expect(seen).toEqual([["notion lead", "Error: no row for [email]", 404]]);
  });

  it("never print a response body or a mail subject", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
      });
    const bad = ["lib", "app", "worker"]
      .flatMap(files)
      .flatMap((f) => readFileSync(f, "utf8").split("\n").map((l, i) => [f, i + 1, l] as const))
      .filter(([, , l]) => /console\.(error|warn|log|info)\(/.test(l) && /\.text\(\)|subject\b|(?<!\bk)\.name\b|\.message\b/.test(l))
      .map(([f, n]) => `${f}:${n}`);
    expect(bad).toEqual([]);
  });
});
