import { describe, expect, it } from "vitest";
import { limited } from "@/lib/http";

/* The public-write limiter's refusal (BASELINE.md ABU-3): a 429 that says when to come back. */

const req = new Request("https://juliangigola.com/api/book", { method: "POST", headers: { "cf-connecting-ip": "203.0.113.9" } });
const limiter = (success: boolean) => ({ limit: async () => ({ success }) });

describe("limited", () => {
  it("lets a request under the limit through", async () => {
    expect(await limited(limiter(true), "book", req)).toBeNull();
  });

  it("refuses past it with a 429 and Retry-After", async () => {
    const res = (await limited(limiter(false), "book", req))!;
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await res.json()).error).toMatch(/Wait/);
  });
});
