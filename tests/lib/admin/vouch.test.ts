import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorised, canPush, fromWorker, refuseAdmin, refuseWorker } from "@/lib/admin/vouch";
import { AdminError, isLocked, loadErrorText, LOCKED } from "@/lib/admin/admin-call";
import { SCOPED, githubToken, reply } from "../../backend/fakes";

/* The gate on /api/inbox and /api/leads, /api/traffic and /api/seo: a token passes only
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

const req = (headers: Record<string, string>) => new Request("https://x.test/api", { headers });

describe("authorised and fromWorker", () => {
  it("authorised matches only the exact inbox key, and nothing when it is unset", async () => {
    expect(await authorised(req({ "x-admin-key": "k1" }), "k1")).toBe(true);
    expect(await authorised(req({ "x-admin-key": "k2" }), "k1")).toBe(false);
    expect(await authorised(req({}), "k1")).toBe(false);
    expect(await authorised(req({ "x-admin-key": "k1" }), undefined)).toBe(false);
  });

  it("fromWorker matches only the booking secret as the bearer", async () => {
    expect(await fromWorker(req({ authorization: "Bearer s3cret" }), "s3cret")).toBe(true);
    expect(await fromWorker(req({ authorization: "Bearer nope" }), "s3cret")).toBe(false);
    expect(await fromWorker(req({}), "s3cret")).toBe(false);
    expect(await fromWorker(req({ authorization: "Bearer s3cret" }), undefined)).toBe(false);
  });

  it("refuseWorker lets the booking secret in and answers anything else with the plain 401", async () => {
    expect(await refuseWorker(req({ authorization: "Bearer s3cret" }), "s3cret")).toBeNull();
    const no = (await refuseWorker(req({ authorization: "Bearer nope" }), "s3cret"))!;
    expect([no.status, await no.json()]).toEqual([401, { error: "Not authorized." }]);
  });
});

describe("refuseAdmin and the desks' lock", () => {
  it("lets the key in, and tells a missing key from a refused token in one 401", async () => {
    expect(await refuseAdmin(req({ "x-admin-key": "k1" }), "k1")).toBeNull();
    const none = (await refuseAdmin(req({}), "k1"))!;
    expect([none.status, (await none.json()).error]).toEqual([401, "Not authorized."]);
    vi.stubGlobal("fetch", vi.fn(async () => reply({ permissions: { push: false } }, 200, SCOPED)));
    const bad = (await refuseAdmin(req({ authorization: `Bearer ${githubToken()}` }), "k1"))!;
    expect([bad.status, (await bad.json()).error]).toEqual([401, "GitHub did not accept that token for this repository."]);
  });

  it("any 401 shows sign-in on a desk, whichever message the route gave", () => {
    expect(isLocked(new AdminError("GitHub did not accept that token for this repository.", 401))).toBe(true);
    expect(loadErrorText(new AdminError("GitHub did not accept that token for this repository.", 401))).toBe(LOCKED);
    expect(isLocked(new AdminError("Gone.", 404))).toBe(false);
    expect(loadErrorText(new AdminError("Gone.", 404))).toBe("Gone.");
  });
});
