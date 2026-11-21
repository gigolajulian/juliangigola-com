import { beforeEach, describe, expect, it, vi } from "vitest";
import { sealer } from "@/lib/leads/lead-crypto";
import { readLead, writeLead } from "@/lib/leads/lead-store";
import { dueTasks, fold, leadSummary, leadStoreKey, type Lead } from "@/lib/leads/leads";
import { callSheet, cleanPlan, cleanTasks, merge } from "@/lib/leads/lead-crm";
import { FakeKV, LEADS_KEY } from "./fakes";

/* The shoot plan and tasks from CRMO (Julian 2026-11-20): kept in the full record, never the list summary;
   whole-list PATCHes; a task newly ticked writes one timeline line; Today lists what falls due. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));
const inbox = await import("@/app/api/inbox/route");

const KEY = "inbox-key-for-tests";
const at = (h: number) => new Date(Date.UTC(2026, 10, 20, h)).toISOString();
const s = await sealer(LEADS_KEY)!;
const EMAIL = "nadia@example.com";
const RIO = { name: "Rio", email: "rio@example.com", role: "Stylist" };

let kv: FakeKV;
beforeEach(() => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY };
});

async function seed(extra: Partial<Lead> = {}) {
  const id = await s.id(EMAIL);
  const lead: Lead = { ...fold(null, EMAIL, { event: { at: at(1), kind: "inquiry", ref: "msg:1" }, name: "Nadia Okafor" }), people: [RIO], ...extra };
  await writeLead(kv as never, s, id, lead);
  return { id, key: `lead:${id}` };
}
const patch = (body: object) =>
  inbox.PATCH(new Request("https://juliangigola.com/api/inbox", { method: "PATCH", body: JSON.stringify(body), headers: { "x-inbox-key": KEY } }));
const get = (q: string) => inbox.GET(new Request(`https://juliangigola.com/api/inbox${q}`, { headers: { "x-inbox-key": KEY } }));

describe("cleanPlan", () => {
  it("keeps his own frames, four at most, a cosmos.so link, and a team only from the lead's people", () => {
    const p = cleanPlan({
      brief: "  One hard light.  ",
      refs: ["https://juliangigola.com/work/sian/02.jpg", "/work/a/1.jpg", "/work/b/2.jpg", "/work/c/3.jpg", "/work/d/4.jpg"],
      cosmos: "cosmos.so/juliangigola/nadia",
      shots: [{ text: "Cover", done: true }, { text: "  " }],
      sheet: { call: "9:15", team: ["Rio@Example.com", "stranger@example.com"] },
    }, [RIO]);
    expect(p).toEqual({
      brief: "One hard light.",
      refs: ["/work/sian/02.jpg", "/work/a/1.jpg", "/work/b/2.jpg", "/work/c/3.jpg"],
      cosmos: "https://cosmos.so/juliangigola/nadia",
      shots: [{ text: "Cover", done: true }],
      sheet: { call: "9:15", team: ["rio@example.com"] },
    });
  });

  it("refuses frames from elsewhere and boards that are not Cosmos; an empty plan is null", () => {
    expect(cleanPlan({ refs: ["https://evil.example/x.jpg"] })).toHaveProperty("error");
    expect(cleanPlan({ refs: ["/work/../secret.jpg"] })).toHaveProperty("error");
    expect(cleanPlan({ cosmos: "https://pinterest.com/board" })).toHaveProperty("error");
    expect(cleanPlan({ cosmos: "javascript:alert(1)" })).toHaveProperty("error");
    expect(cleanPlan({ brief: " ", shots: [] })).toBeNull();
    expect(cleanPlan(null)).toBeNull();
  });
});

describe("cleanTasks", () => {
  it("stamps a task done once, keeps the first time, and writes one timeline line", () => {
    const one = cleanTasks([{ id: "a", text: "Rent red gel", due: "2026-12-02", doneAt: "x" }], [], [], at(5));
    if ("error" in one) throw new Error(one.error);
    expect(one.tasks[0].doneAt).toBe(at(5));
    expect(one.events).toEqual([{ at: at(5), kind: "task", ref: "task:a", note: "Rent red gel" }]);
    const two = cleanTasks(one.tasks, one.tasks, [], at(6));
    if ("error" in two) throw new Error(two.error);
    expect(two.tasks[0].doneAt).toBe(at(5));
    expect(two.events).toEqual([]);
  });

  it("drops a bad day and an unknown person, keeps a person from People", () => {
    const r = cleanTasks([{ id: "a", text: "Pull wardrobe", due: "Dec 4", who: "rio@example.com" }, { id: "b", text: "Scout", who: "x@y.com" }], [], [RIO]);
    if ("error" in r) throw new Error(r.error);
    expect(r.tasks).toEqual([{ id: "a", text: "Pull wardrobe", who: "rio@example.com" }, { id: "b", text: "Scout" }]);
    expect(cleanTasks([{ id: "a", text: "" }])).toHaveProperty("error");
  });
});

describe("dueTasks", () => {
  it("lists open tasks due within a week, late ones first and flagged, done and undated left out", () => {
    const rows = dueTasks([
      { id: "1", text: "Prep crop", due: "2026-12-08" },
      { id: "2", text: "Wardrobe", due: "2026-11-27" },
      { id: "3", text: "Gel", due: "2026-11-18" },
      { id: "4", text: "Done", due: "2026-11-19", doneAt: at(1) },
      { id: "5", text: "Someday" },
      { id: "6", text: "Today", due: "2026-11-20" },
    ], "2026-11-20");
    expect(rows.map((t) => [t.text, t.late])).toEqual([["Gel", true], ["Today", false], ["Wardrobe", false]]);
  });
});

describe("plan and tasks in the record", () => {
  it("stay out of the list summary, so a long plan never costs the lead its metadata", async () => {
    const { id } = await seed({ plan: { brief: "x".repeat(1000), shots: Array.from({ length: 30 }, () => ({ text: "y".repeat(120) })) }, tasks: [{ id: "a", text: "z".repeat(80) }] });
    expect(JSON.stringify(kv.data.get(leadStoreKey(id))!.metadata).length).toBeLessThan(1024);
    const sum = leadSummary((await readLead(kv as never, s, id))!);
    expect(sum).not.toHaveProperty("plan");
    expect(sum).not.toHaveProperty("tasks");
  });

  it("PATCH saves the plan and tasks, a tick lands on the timeline, ?tasks lists the open ones", async () => {
    const { id, key } = await seed();
    let res = await patch({ key, plan: { brief: "Album cover", sheet: { team: [RIO.email] } } });
    expect(res.status).toBe(200);
    res = await patch({ key, tasks: [{ id: "a", text: "Confirm MUA", due: "2026-11-28" }, { id: "b", text: "Rent gel", due: "2026-12-02", who: RIO.email }] });
    expect(res.status).toBe(200);
    res = await patch({ key, tasks: [{ id: "a", text: "Confirm MUA", due: "2026-11-28", doneAt: "now" }, { id: "b", text: "Rent gel", due: "2026-12-02", who: RIO.email }] });
    const { lead } = (await res.json()) as { lead: Lead };
    expect(lead.plan).toEqual({ brief: "Album cover", sheet: { team: [RIO.email] } });
    expect(lead.events.filter((e) => e.kind === "task").map((e) => e.note)).toEqual(["Confirm MUA"]);
    const { tasks } = (await (await get("?tasks")).json()) as { tasks: { id: string; lead: string; name: string }[] };
    expect(tasks).toEqual([{ id: "b", text: "Rent gel", due: "2026-12-02", who: RIO.email, lead: id, name: "Nadia Okafor" }]);
    expect((await patch({ key, plan: { cosmos: "https://example.com" } })).status).toBe(400);
    expect((await patch({ key, plan: null })).status).toBe(200);
    expect((await readLead(kv as never, s, id))!.plan).toBeUndefined();
  });

  it("merge keeps both records' tasks and this one's plan", () => {
    const a = { ...fold(null, EMAIL, { event: { at: at(1), kind: "inquiry" } }), tasks: [{ id: "a", text: "One" }], plan: { brief: "Mine" } };
    const b = { ...fold(null, "other@example.com", { event: { at: at(2), kind: "inquiry" } }), tasks: [{ id: "b", text: "Two" }], plan: { brief: "Theirs" } };
    const m = merge(a, b, at(3));
    expect(m.tasks?.map((t) => t.id)).toEqual(["a", "b"]);
    expect(m.plan).toEqual({ brief: "Mine" });
  });
});

describe("callSheet", () => {
  it("drafts to the client and the team, in Pacific, with the shot list and board", () => {
    const d = callSheet({
      name: "Nadia", email: EMAIL, when: "2026-12-06T18:00:00Z", people: [RIO, { name: "Lena", email: "lena@example.com" }],
      plan: { cosmos: "https://cosmos.so/b", shots: [{ text: "Cover" }], sheet: { call: "9:15", window: "10:00 to 1:00", place: "Studio, San Jose", team: [RIO.email] } },
    });
    expect(d.to).toBe(`${EMAIL},${RIO.email}`);
    expect(d.subject).toBe("Call sheet: Sunday, December 6");
    expect(d.body).toContain("Team: Rio (Stylist)");
    expect(d.body).toContain("- Cover");
    expect(d.body).toContain("Board: https://cosmos.so/b");
  });
});
