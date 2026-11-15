import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/proof/[token]/route";
import { sealer } from "@/lib/leads/lead-crypto";
import { cleanSettings, readProof, writeProof, type Proof } from "@/lib/proofs/proof";
import { digestMail, worthMail } from "@/lib/email/proof-mail";
import { finalize } from "@/lib/proofs/submit";
import { daily } from "@/worker/index";
import { FakeKV, LEADS_KEY } from "./fakes";

/* Per-gallery notifications (Julian 2026-11-15): "each" mails hello@ on an open or a
   download, throttled; "daily" waits for the summary; "off" silences even Selects in;
   unset is the old way. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const TOKEN = "AbCdEfGh12345678";
let kv: FakeKV;
let sent: { subject: string; text: string }[];
const seal = async () => (await sealer(LEADS_KEY))!;
const base = (over: Partial<Proof> = {}): Proof => ({ token: TOKEN, name: "Ana portraits", included: 2, price: 15, days: 14, createdAt: "2026-11-01T00:00:00Z", sentAt: "2026-11-01T00:00:00Z", frames: [{ id: "a", file: "a.jpg", w: 1, h: 1 }], selects: [], notes: {}, views: 0, ...over });
beforeEach(() => {
  kv = new FakeKV();
  sent = [];
  ctx.env = { INBOX: kv, LEADS_KEY, BOOKING_SECRET: "s", DEPOSIT_LIMIT: { limit: async () => ({ success: true }) }, EMAIL: { send: async (m: { subject: string; text: string }) => void sent.push(m) } };
});
const open = (email = "ana@gmail.com") => POST(new Request("https://juliangigola.com/api/proof/x", { method: "POST", body: JSON.stringify({ action: "track", email, kind: "open" }) }), { params: Promise.resolve({ token: TOKEN }) });

describe("notify setting", () => {
  it("takes the three choices, clears on selects or null, ignores the rest", () => {
    expect(cleanSettings({ notify: "daily" })).toEqual({ notify: "daily" });
    expect(cleanSettings({ notify: "selects" })).toEqual({ notify: undefined });
    expect("notify" in cleanSettings({ notify: "loud" })).toBe(false);
  });
});

describe("instant mails", () => {
  it("mails an open on each, once per half hour, never for a test address or another setting", async () => {
    await writeProof(kv as never, await seal(), base({ notify: "each" }));
    await open();
    await open();
    await open("qa@example.com");
    expect(sent.map((m) => m.subject)).toEqual(["Opened: Ana portraits"]);
    expect(sent[0].text).toContain("ana@gmail.com opened the proofs of Ana portraits.");
    await writeProof(kv as never, await seal(), base({ notify: "daily" }));
    await open("ben@gmail.com");
    await writeProof(kv as never, await seal(), base());
    await open("cy@gmail.com");
    expect(sent).toHaveLength(1);
  });

  it("throttles by the address's own last event of that kind", () => {
    const ev = [{ at: "2026-11-15T10:00:00.000Z", kind: "open" as const }];
    expect(worthMail(ev, "open", "2026-11-15T10:20:00.000Z", 30)).toBe(false);
    expect(worthMail(ev, "open", "2026-11-15T10:31:00.000Z", 30)).toBe(true);
    expect(worthMail(ev, "download", "2026-11-15T10:01:00.000Z", 10)).toBe(true);
  });

  it("off silences the Selects in alert; unset keeps it", async () => {
    for (const notify of ["off", undefined] as const) {
      sent = [];
      const p = base({ notify, selects: ["a"], submittedBy: "ana@gmail.com" });
      await finalize(ctx.env as never, kv as never, await seal(), p);
      expect(sent.some((m) => m.subject.startsWith("Selects in"))).toBe(notify !== "off");
    }
  });
});

describe("daily summary", () => {
  const ev = (at: string, kind: "open" | "pick" | "send" | "download") => ({ at, kind });
  const viewer = (events: ReturnType<typeof ev>[]) => ({ first: events[0].at, last: events.at(-1)!.at, visits: 1, seconds: 0, devices: [], places: [], picks: [], looks: {}, events });

  it("counts each daily gallery's window, skips test addresses, and is null on a quiet day", () => {
    const p = base({ notify: "daily", viewers: { "ana@gmail.com": { ...viewer([ev("2026-11-14T18:00:00Z", "open"), ev("2026-11-14T18:01:00Z", "pick"), ev("2026-11-14T18:02:00Z", "pick"), ev("2026-11-14T18:03:00Z", "send"), ev("2026-11-13T01:00:00Z", "open")]), name: "Ana" }, "qa@example.com": viewer([ev("2026-11-14T18:00:00Z", "open")]) } });
    const other = base({ name: "Not daily", viewers: { "x@gmail.com": viewer([ev("2026-11-14T18:00:00Z", "open")]) } });
    const m = digestMail([p, other], "2026-11-14T16:00:00Z", "2026-11-15T16:00:00Z")!;
    expect(m.subject).toBe("Galleries today: 1 visitor");
    expect(m.lines).toContain("  Ana (ana@gmail.com): opened 1 time, picked 2, sent selects");
    expect(m.lines.join("\n")).not.toContain("qa@example.com");
    expect(m.lines.join("\n")).not.toContain("Not daily");
    expect(digestMail([p], "2026-11-15T16:00:00Z", "2026-11-16T16:00:00Z")).toBeNull();
  });

  it("the endpoint refuses a wrong bearer, sends once, and moves its own mark", async () => {
    const { POST: run } = await import("@/app/api/proof/daily/route");
    const recent = new Date(Date.now() - 36e5).toISOString();
    await writeProof(kv as never, await seal(), base({ notify: "daily", viewers: { "ana@gmail.com": viewer([ev(recent, "open")]) } }));
    const call = (q = "", auth = "Bearer s") => run(new Request(`https://juliangigola.com/api/proof/daily${q}`, { method: "POST", headers: { authorization: auth } }));
    expect((await call("", "Bearer no")).status).toBe(401);
    expect((await (await call("?dry")).json()).subject).toBe("Galleries today: 1 visitor");
    expect(sent).toEqual([]);
    expect(await (await call()).json()).toEqual({ sent: true });
    expect(await (await call()).json()).toEqual({ sent: false });
    expect(sent).toHaveLength(1);
    // The gallery itself is never written by the summary.
    expect((await readProof(kv as never, await seal(), TOKEN))!.viewers).toBeDefined();
  });

  it("the worker asks only at 9 AM Pacific and never throws", async () => {
    const hits: string[] = [];
    const env = { BOOKING_SECRET: "s", SITE: { fetch: async (u: string) => (hits.push(u), Response.json({})) } } as never;
    await daily(env, new Date("2026-11-15T16:00:00Z"));
    await daily(env, new Date("2026-11-15T17:00:00Z"));
    expect(hits).toEqual(["https://juliangigola.com/api/proof/daily"]);
    await expect(daily({ BOOKING_SECRET: "s", SITE: { fetch: async () => { throw new Error("down"); } } } as never, new Date("2026-11-15T17:00:00Z"))).resolves.toBeUndefined();
  });
});
