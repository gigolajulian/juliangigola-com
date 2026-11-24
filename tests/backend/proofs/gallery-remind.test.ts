import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/proof/route";
import { sealer } from "@/lib/seal";
import { reminderMail } from "@/lib/proofs/proof-mail";
import { pushFor } from "@/lib/leads/lead-push";
import { closingSoon, remindState, type Proof } from "@/lib/proofs/proof-model";
import { readProof, writeProof } from "@/lib/proofs/proof-store";
import { FakeKV, LEADS_KEY } from "../fakes";
import { DAY_MS } from "@/lib/time-zone";

/* The one reminder per stage, on Julian's tap (2026-11-15), and the client page's "Closes" line. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx));

const ID = "11152026-k7m2q9xd";
const NOW = Date.parse("2026-11-17T20:00:00Z");
const base = { token: ID, name: "Maya", email: "maya@gmail.com", included: 10, price: 15, days: 14, createdAt: "2026-11-01T00:00:00Z", frames: [{ id: "a", file: "a.jpg", w: 1, h: 1 }], selects: [], notes: {}, views: 0 } as Proof;
const sentP = (closesIn: number, more: Partial<Proof> = {}): Proof => ({ ...base, sentAt: "2026-11-06T00:00:00Z", closesAt: new Date(NOW + closesIn * DAY_MS).toISOString(), ...more });

describe("remindState", () => {
  it("is ready only in the last 5 days, and locked before", () => {
    expect(remindState(sentP(3), NOW)).toEqual({ stage: "proofs", state: "ready" });
    const r = remindState(sentP(12), NOW);
    expect(r.state).toBe("locked");
    expect(r.state === "locked" && Date.parse(r.opensAt)).toBe(NOW + 7 * DAY_MS);
  });
  it("refuses a second, a sent or downloaded client, a closed, offline or unsent gallery", () => {
    expect(remindState(sentP(3, { reminded: { proofs: "2026-11-16T00:00:00Z" } }), NOW).state).toBe("sent");
    expect(remindState(sentP(3, { submittedAt: "2026-11-15T00:00:00Z" }), NOW).state).toBe("never");
    expect(remindState(sentP(-1), NOW).state).toBe("never");
    expect(remindState(sentP(3, { offline: true }), NOW).state).toBe("never");
    expect(remindState(sentP(3, { email: undefined }), NOW).state).toBe("never");
    expect(remindState({ ...base, closesAt: sentP(3).closesAt }, NOW)).toMatchObject({ stage: null, state: "never" });
    const fin = { deliveredAt: "2026-11-10T00:00:00Z", reminded: { proofs: "2026-11-01T00:00:00Z" } };
    expect(remindState(sentP(3, fin), NOW)).toEqual({ stage: "finals", state: "ready" });
    expect(remindState(sentP(3, { ...fin, firstDownloadAt: "2026-11-11T00:00:00Z" }), NOW).state).toBe("never");
  });
  it("closingSoon counts days left inside the window only", () => {
    expect(closingSoon(sentP(3).closesAt, NOW)).toBe(3);
    expect(closingSoon(sentP(2.2).closesAt, NOW)).toBe(3);
    expect(closingSoon(sentP(6).closesAt, NOW)).toBeNull();
    expect(closingSoon(sentP(-1).closesAt, NOW)).toBeNull();
    expect(closingSoon(null, NOW)).toBeNull();
  });
});

describe("reminder mail", () => {
  it("proofs: the client's own picks so far, none said when zero; finals: when to save by", () => {
    const viewers = { "maya@gmail.com": { first: "", last: "", visits: 1, seconds: 0, devices: [], places: [], picks: ["a", "b", "c", "d"], looks: {}, events: [] } };
    const p = sentP(3, { closesAt: "2026-11-21T07:00:00Z", viewers });
    expect(reminderMail(p, "proofs").subject).toBe("Your proofs close Nov 20");
    expect(reminderMail(p, "proofs").text).toContain("Pick your 10 frames by November 20 and I'll start editing. You have 4 so far.");
    expect(reminderMail({ ...p, viewers: undefined }, "proofs").text).not.toContain("so far");
    const f = reminderMail({ ...p, deliveredAt: "2026-11-10T00:00:00Z" }, "finals");
    expect(f.subject).toBe("Your photos close Nov 20");
    expect(f.text).toContain("Save them by November 20.");
    expect(f.text).toContain("/delivery/");
  });
});

describe("POST remind", () => {
  let kv: FakeKV;
  let sent: { to: string; subject: string }[];
  let fail = false;
  const req = (method: string, body?: unknown, query = "") => new Request(`https://juliangigola.com/api/proof${query}`, { method, body: body ? JSON.stringify(body) : undefined, headers: { "x-admin-key": "k" } });
  const seal = async () => (await sealer(LEADS_KEY))!;
  beforeEach(async () => {
    kv = new FakeKV();
    sent = [];
    fail = false;
    ctx.env = { INBOX: kv, INBOX_KEY: "k", LEADS_KEY, PROOFS: { delete: async () => {}, get: async () => null }, CLIENT_EMAIL: { send: async (m: { to: string; subject: string }) => { if (fail) throw new Error("down"); sent.push(m); } } };
  });

  it("sends once, stamps the stage, keeps the close date, and refuses the second tap", async () => {
    const p = sentP(3, { closesAt: new Date(Date.now() + 3 * DAY_MS).toISOString() });
    await writeProof(kv as never, await seal(), p);
    expect((await POST(req("POST", { action: "remind", token: ID })))!.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("maya@gmail.com");
    const after = (await readProof(kv as never, await seal(), ID))!;
    expect(after.reminded?.proofs).toBeTruthy();
    expect(after.closesAt).toBe(p.closesAt);
    expect((await POST(req("POST", { action: "remind", token: ID })))!.status).toBe(409);
    expect(sent).toHaveLength(1);
  });

  it("refuses before the window and after selects are in", async () => {
    await writeProof(kv as never, await seal(), sentP(12, { closesAt: new Date(Date.now() + 12 * DAY_MS).toISOString() }));
    expect((await POST(req("POST", { action: "remind", token: ID })))!.status).toBe(409);
    await writeProof(kv as never, await seal(), sentP(3, { closesAt: new Date(Date.now() + 3 * DAY_MS).toISOString(), submittedAt: new Date().toISOString() }));
    expect((await POST(req("POST", { action: "remind", token: ID })))!.status).toBe(409);
    expect(sent).toHaveLength(0);
  });

  it("a failed mail clears the stamp so he can try again", async () => {
    await writeProof(kv as never, await seal(), sentP(3, { closesAt: new Date(Date.now() + 3 * DAY_MS).toISOString() }));
    fail = true;
    expect((await POST(req("POST", { action: "remind", token: ID })))!.status).toBe(502);
    expect((await readProof(kv as never, await seal(), ID))!.reminded).toBeUndefined();
  });

  it("the preview shows the mail and who gets it", async () => {
    await writeProof(kv as never, await seal(), sentP(3, { closesAt: new Date(Date.now() + 3 * DAY_MS).toISOString() }));
    const o = await (await GET(req("GET", undefined, `?remind=${ID}`)))!.json();
    expect(o.to).toBe("maya@gmail.com");
    expect(o.subject).toMatch(/^Your proofs close /);
    expect(o.remind).toEqual({ stage: "proofs", state: "ready" });
  });
});

it("the first download pings his devices", () => {
  expect(pushFor({ name: "Maya Chen", kind: "Portraits" } as never, { at: "", kind: "download" } as never)).toMatchObject({ title: "Finals downloaded", body: "Maya Chen, Portraits" });
});
