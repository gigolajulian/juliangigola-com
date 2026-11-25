import { beforeEach, describe, expect, it, vi } from "vitest";
import { upstreamError } from "@/lib/http";
import { onRequestError } from "@/instrumentation";
import { FakeEmail, FakeKV } from "../fakes";

/* OBS-1: a server error mails hello@, once an hour per label, so a stranger forcing errors cannot flood the inbox. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown>, later: [] as Promise<unknown>[] }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx, (p) => ctx.later.push(p)));

let mail: FakeEmail;
beforeEach(() => {
  mail = new FakeEmail();
  ctx.later = [];
  ctx.env = { INBOX: new FakeKV(), EMAIL: mail };
});
/** The alert runs after the answer: wait for the import, then the work handed to waitUntil. */
const settled = async () => {
  await vi.waitFor(() => expect(ctx.later.length).toBeGreaterThan(0));
  await Promise.all(ctx.later.splice(0));
};

describe("error alerts", () => {
  it("mail hello@ on an upstream error, once an hour per label", async () => {
    expect(upstreamError("deposit intent", new Error("Stripe 500"), "Payments are down.").status).toBe(502);
    await settled();
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].subject).toBe("Site error: deposit intent");
    expect(String(mail.sent[0].text)).toContain("Stripe 500");
    upstreamError("deposit intent", new Error("Stripe 500 again"), "Payments are down.");
    await settled();
    expect(mail.sent).toHaveLength(1);
    upstreamError("slots", new Error("Google 503"), "Could not reach the calendar.");
    await settled();
    expect(mail.sent.map((m) => m.subject)).toEqual(["Site error: deposit intent", "Site error: slots"]);
  });

  it("mail hello@ when a route throws, named by its route", async () => {
    await onRequestError(new Error("boom"), { method: "GET", path: "/proof/abc" }, { routePath: "/proof/[token]" });
    expect(mail.sent.map((m) => m.subject)).toEqual(["Site error: GET /proof/[token]"]);
  });
});
