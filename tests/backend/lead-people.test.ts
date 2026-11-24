import { beforeEach, describe, expect, it, vi } from "vitest";
import { sealer } from "@/lib/leads/lead-crypto";
import { copiesFor, findLead, personKey, readLead, recordLead, writeLead } from "@/lib/leads/lead-store";
import { applyLeadEvent, leadSummary, leadStoreKey, type Lead, type Person } from "@/lib/leads/leads";
import { cleanPeople, merge, PEOPLE_MAX } from "@/lib/leads/lead-crm";
import { readProof, writeProof } from "@/lib/proofs/proof-store";
import { FakeKV, LEADS_KEY, INBOX_KEY as KEY } from "./fakes";
import { desk } from "./desk-routes";

/* Several people under one client (Julian 2026-11-15): the art director,
   the producer and the stylist sit on the brand's lead, their mail lands
   there, and gallery mail copies the ones he ticked. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("./fakes")).cloudflareMock(ctx));
const proof = await import("@/app/api/proof/route");

const at = (h: number) => new Date(Date.UTC(2026, 10, 15, h)).toISOString();
const s = await sealer(LEADS_KEY)!;
const BRAND = "brand@example.com";
const AD = { name: "Ana Diaz", email: "ana@agency.com", role: "Art director" };

let kv: FakeKV;
beforeEach(() => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY };
});

/** The brand's lead, with people on it and their aliases written. */
async function brand(people: Person[] = [AD]) {
  const id = await s.id(BRAND);
  const lead: Lead = { ...applyLeadEvent(null, BRAND, { event: { at: at(1), kind: "inquiry", ref: "msg:1" }, name: "Brand Co" }), people };
  await writeLead(kv as never, s, id, lead);
  for (const p of people) await kv.put(personKey(await s.id(p.email)), id);
  return { id, key: `lead:${id}` };
}
const patch = (body: object) =>
  desk("PATCH", "", { body });

describe("findLead", () => {
  it("finds a person's lead, prefers an address's own lead, and ignores an alias whose lead is gone", async () => {
    const { id } = await brand();
    expect((await findLead(kv as never, s, "Ana@Agency.com")).id).toBe(id);
    // Their own lead wins over the alias.
    const own = await s.id(AD.email);
    await writeLead(kv as never, s, own, applyLeadEvent(null, AD.email, { event: { at: at(2), kind: "inquiry" } }));
    expect((await findLead(kv as never, s, AD.email)).id).toBe(own);
    await kv.delete(leadStoreKey(own));
    // The brand's lead emptied from the trash: the alias points nowhere, so a new lead starts at her own id.
    await kv.delete(leadStoreKey(id));
    expect(await findLead(kv as never, s, AD.email)).toEqual({ id: own, lead: null });
  });

  it("folds a person's mail, booking or proof open into the client's lead instead of a new one", async () => {
    const { id } = await brand();
    await recordLead({ INBOX: kv as never, LEADS_KEY }, AD.email, { event: { at: at(3), kind: "wrote", ref: "gm-1", note: "Shot list" } });
    await recordLead({ INBOX: kv as never, LEADS_KEY }, AD.email, { event: { at: at(4), kind: "proofs", ref: "tok", note: "Nov 15" }, name: "Ana" });
    const lead = await readLead(kv as never, s, id);
    expect(lead?.events.map((e) => e.kind)).toEqual(["inquiry", "wrote", "proofs"]);
    expect(lead?.name).toBe("Brand Co");
    expect(await readLead(kv as never, s, await s.id(AD.email))).toBeNull();
  });
});

describe("people in the record", () => {
  it("stay out of the list summary, so a lead with the most people still fits KV metadata", async () => {
    const people = Array.from({ length: PEOPLE_MAX }, (_, i) => ({ name: "X".repeat(80), email: `${"p".repeat(100)}${i}@example.com`, role: "R".repeat(40), phone: "1".repeat(40) }));
    const { id } = await brand(people);
    const row = kv.data.get(leadStoreKey(id))!;
    expect(JSON.stringify(row.metadata).length).toBeLessThan(1024);
    expect(leadSummary((await readLead(kv as never, s, id))!)).not.toHaveProperty("people");
  });

  it("are checked: real addresses, none twice, never the lead's own, copy on unless unticked", () => {
    expect(cleanPeople([{ name: "Ana", email: "Ana@Agency.com", role: " AD ", cc: true }, { email: "ana@agency.com" }, { name: "Sam", email: "sam@x.co", cc: false }], BRAND)).toEqual([
      { name: "Ana", email: "ana@agency.com", role: "AD" },
      { name: "Sam", email: "sam@x.co", cc: false },
    ]);
    expect(cleanPeople([{ email: "Ana <ana@agency.com>" }], BRAND)).toHaveProperty("error");
    expect(cleanPeople([{ email: "" }], BRAND)).toHaveProperty("error");
    expect(cleanPeople([{ email: "b.rand@example.com" }], "brand@example.com")).toEqual([{ name: "b.rand", email: "b.rand@example.com" }]);
    expect(cleanPeople([{ email: "b.r.a.n.d+x@gmail.com" }], "brand@gmail.com")).toHaveProperty("error");
    expect(cleanPeople(Array.from({ length: PEOPLE_MAX + 1 }, (_, i) => ({ email: `p${i}@x.co` })), BRAND)).toHaveProperty("error");
    expect(cleanPeople("nope", BRAND)).toHaveProperty("error");
  });

  it("join on a merge, once each, and never as the lead's own address", () => {
    const a = { ...applyLeadEvent(null, BRAND, { event: { at: at(1), kind: "inquiry" } }), people: [AD] };
    const b = { ...applyLeadEvent(null, "other@x.co", { event: { at: at(2), kind: "inquiry" } }), people: [{ ...AD, role: "AD" }, { name: "B", email: BRAND }, { name: "Sam", email: "sam@x.co" }] };
    // The merged record's own address joins too, so its mail keeps landing here.
    expect(merge(a, b, at(3)).people).toEqual([AD, { name: "Sam", email: "sam@x.co" }, { name: "other@x.co", email: "other@x.co" }]);
  });
});

describe("PATCH people", () => {
  it("saves the list, points each address at the lead, and drops the alias of someone taken off", async () => {
    const { id, key } = await brand([]);
    const res = await patch({ key, people: [AD, { name: "Sam", email: "sam@x.co", cc: false }] });
    expect(res.status).toBe(200);
    expect((await res.json()).lead.people).toEqual([AD, { name: "Sam", email: "sam@x.co", cc: false }]);
    expect(await kv.get(personKey(await s.id("sam@x.co")))).toBe(id);
    await patch({ key, people: [AD] });
    expect(await kv.get(personKey(await s.id("sam@x.co")))).toBeNull();
    expect(await kv.get(personKey(await s.id(AD.email)))).toBe(id);
    expect(JSON.stringify([...kv.data.keys()])).not.toContain("agency.com");
    await patch({ key, people: [] });
    expect(await readLead(kv as never, s, id)).not.toHaveProperty("people");
  });

  it("refuses a bad address, one with its own lead, and one already on another lead", async () => {
    const { key } = await brand([]);
    expect((await patch({ key, people: [{ email: "nope" }] })).status).toBe(400);
    await writeLead(kv as never, s, await s.id("own@x.co"), applyLeadEvent(null, "own@x.co", { event: { at: at(2), kind: "inquiry" } }));
    const own = await patch({ key, people: [{ email: "own@x.co" }] });
    expect(own.status).toBe(409);
    expect((await own.json()).error).toMatch(/Merge/);
    const other = await s.id("other@x.co");
    await writeLead(kv as never, s, other, { ...applyLeadEvent(null, "other@x.co", { event: { at: at(2), kind: "inquiry" } }), people: [{ name: "T", email: "taken@x.co" }] });
    await kv.put(personKey(await s.id("taken@x.co")), other);
    expect((await patch({ key, people: [{ email: "taken@x.co" }] })).status).toBe(409);
    // An alias left behind by a lead that no longer lists the address blocks nothing and routes nothing.
    await kv.put(personKey(await s.id("stale@x.co")), other);
    expect((await findLead(kv as never, s, "stale@x.co")).lead).toBeNull();
    expect((await patch({ key, people: [{ email: "stale@x.co" }] })).status).toBe(200);
  });
});

describe("gallery mail", () => {
  it("copies the people with it on, and the client when the gallery went to one of their people", async () => {
    await brand([AD, { name: "Sam", email: "sam@x.co", cc: false }, { name: "Lee", email: "lee@x.co" }]);
    expect(await copiesFor(kv as never, s, BRAND)).toEqual([AD.email, "lee@x.co"]);
    expect(await copiesFor(kv as never, s, AD.email)).toEqual([BRAND, "lee@x.co"]);
    expect(await copiesFor(kv as never, s, "nobody@x.co")).toEqual([]);
  });

  it("goes out with the copies at Send finals", async () => {
    await brand([AD, { name: "Sam", email: "sam@x.co", cc: false }]);
    const sent: { to: string; cc?: string[] }[] = [];
    const r2 = { put: vi.fn(async () => {}), get: vi.fn(async () => null), delete: vi.fn(async () => {}) };
    ctx.env = { ...ctx.env, PROOFS: r2, CLIENT_EMAIL: { send: async (m: { to: string; cc?: string[] }) => void sent.push(m) } };
    const post = (body: object) => proof.POST(new Request("https://juliangigola.com/api/proof", { method: "POST", body: JSON.stringify(body), headers: { "x-inbox-key": KEY } }));
    const { token } = await (await post({ action: "create", name: "Brand Co" }))!.json();
    const p = (await readProof(kv as never, s, token))!;
    await writeProof(kv as never, s, { ...p, email: BRAND, finals: [{ id: "a1", file: "a.jpg", w: 10, h: 10, bytes: 1, crc: 1 }] });
    expect((await post({ action: "deliver", token }))!.status).toBe(200);
    expect(sent).toMatchObject([{ to: BRAND, cc: [AD.email] }]);
  });

  it("still reaches the client when a copy address is refused", async () => {
    const { sendClient } = await import("@/lib/email/proof-mail");
    const tries: { cc?: string[] }[] = [];
    const mailer = { send: async (m: { cc?: string[] }) => { tries.push(m); if (m.cc) throw new Error("bad cc"); } };
    expect(await sendClient(mailer as never, BRAND, { subject: "s", html: "<p>", text: "t", attachments: [] }, ["bad@x.co"])).toBe(true);
    expect(tries.map((t) => !!t.cc)).toEqual([true, true, false]);
  });
});
