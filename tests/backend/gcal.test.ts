import { beforeEach, describe, expect, it, vi } from "vitest";
import { forgetToken, gcal, gcalToken } from "@/lib/gcal";

/* hello@'s calendar (`lib/gcal.ts`): one token swap per hour, a 401 asks
   for a fresh token once, and no error carries the token. */

const SECRET = JSON.stringify({ client_id: "id", client_secret: "shh", refresh_token: "rt-secret" });
let swaps: number;
let reject401: number;

beforeEach(() => {
  forgetToken();
  swaps = 0;
  reject401 = 0;
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      swaps++;
      return Response.json({ access_token: `at-${swaps}`, expires_in: 3599 });
    }
    if (reject401-- > 0) return new Response("{}", { status: 401 });
    return Response.json({ ok: true });
  });
});

describe("gcal", () => {
  it("keeps the access token until near its expiry", async () => {
    const now = Date.now();
    expect(await gcalToken(SECRET, now)).toBe("at-1");
    expect(await gcalToken(SECRET, now + 50 * 60e3)).toBe("at-1");
    expect(await gcalToken(SECRET, now + 56 * 60e3)).toBe("at-2");
  });

  it("retries a 401 once with a fresh token", async () => {
    reject401 = 1;
    expect(await gcal(SECRET, "/freeBusy", { body: {} })).toEqual({ ok: true });
    expect(swaps).toBe(2);
  });

  it("says when the secret is missing or refused, never the token", async () => {
    await expect(gcalToken(undefined)).rejects.toThrow("GCAL_OAUTH is not set");
    await expect(gcalToken("rt-secret-not-json")).rejects.toThrow(/^GCAL_OAUTH is not valid JSON$/);
    vi.stubGlobal("fetch", async () => Response.json({ error: "invalid_grant" }, { status: 400 }));
    const e = await gcalToken(SECRET).catch((x: Error) => x.message);
    expect(e).toBe("Google token refused: invalid_grant");
    expect(e).not.toContain("rt-secret");
  });
});
