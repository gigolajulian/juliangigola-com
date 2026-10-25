import { beforeEach, describe, expect, it, vi } from "vitest";
import { canPush } from "@/lib/vouch";
import { SCOPED, githubToken, reply } from "./fakes";

/* The gate on /api/inbox, /api/traffic and /api/seo: a token passes only
   when its owner can push AND the token itself was granted the write. No
   real GitHub call: fetch is a stub. */

let n = 0;
const fine = () => `github_pat_${"f".repeat(30)}${String(++n).padStart(6, "0")}`;
const PUSH = { permissions: { push: true } };

beforeEach(() => vi.unstubAllGlobals());

describe("canPush", () => {
  it("lets a classic token through only with repo or public_repo scope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(PUSH, 200, SCOPED)));
    expect(await canPush(githubToken())).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => reply(PUSH, 200, { "x-oauth-scopes": "public_repo, gist" })));
    expect(await canPush(githubToken())).toBe(true);
    // A pusher's classic token made with no scopes, or only read:user.
    vi.stubGlobal("fetch", vi.fn(async () => reply(PUSH, 200, { "x-oauth-scopes": "" })));
    expect(await canPush(githubToken())).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => reply(PUSH, 200, { "x-oauth-scopes": "read:user" })));
    expect(await canPush(githubToken())).toBe(false);
  });

  it("lets Julian's fine-grained token through when it holds Contents write", async () => {
    const fetch = vi.fn(async (_u: string, init?: RequestInit) =>
      init?.method === "PUT" ? reply({ message: "Invalid request." }, 422) : reply(PUSH));
    vi.stubGlobal("fetch", fetch);
    expect(await canPush(fine())).toBe(true);
    // The probe never carries content, so it can never write.
    const put = fetch.mock.calls.find(([, i]) => i?.method === "PUT")!;
    expect(put[1]!.body).toBe("{}");
  });

  it("refuses a fine-grained token without Contents write", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) =>
      init?.method === "PUT" ? reply({ message: "Resource not accessible by personal access token" }, 403) : reply(PUSH)));
    expect(await canPush(fine())).toBe(false);
  });

  it("refuses OAuth, app and refresh tokens before asking GitHub", async () => {
    const fetch = vi.fn(async () => reply(PUSH, 200, SCOPED));
    vi.stubGlobal("fetch", fetch);
    for (const p of ["gho_", "ghu_", "ghs_", "ghr_"]) expect(await canPush(`${p}${"t".repeat(36)}`)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a token whose owner cannot push, whatever it was granted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ permissions: { push: false } }, 200, SCOPED)));
    expect(await canPush(githubToken())).toBe(false);
  });
});
