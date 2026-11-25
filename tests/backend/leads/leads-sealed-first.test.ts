import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKV, INBOX_KEY as KEY } from "../fakes";
import { desk } from "../desk-routes";

/* With LEADS_KEY unset, PATCH and POST say 503 before they read the body, so a bad body cannot hide the missing key. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx));

beforeEach(() => {
  ctx.env = { INBOX: new FakeKV(), INBOX_KEY: KEY };
});

describe("leads without LEADS_KEY", () => {
  for (const method of ["PATCH", "POST"] as const) {
    it(`${method} answers 503 even for a body that is not JSON`, async () => {
      expect((await desk(method, "", { body: "not json" })).status).toBe(503);
    });
  }
});
