import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH, POST, PUT } from "@/app/api/contract/route";
import { POST as SIGN } from "@/app/api/contract/[id]/route";
import { sealer } from "@/lib/leads/lead-crypto";
import { readLead, writeLead } from "@/lib/leads/lead-store";
import { fillContract, readContract, signedCopy, type Contract } from "@/lib/contracts/contract";
import { sha256Hex } from "@/lib/utils";
import type { Lead } from "@/lib/leads/leads";
import { FakeEmail, FakeKV, LEADS_KEY, INBOX_KEY as KEY } from "./fakes";

/* /api/contract (the desk) and /api/contract/[id] (the client): a contract
   made from a lead's template, sent, signed once with a hash of the exact
   text, then locked. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("./fakes")).cloudflareMock(ctx));

const LEAD = "a".repeat(32);
let kv: FakeKV, client: FakeEmail, hello: FakeEmail;
const seal = async () => (await sealer(LEADS_KEY))!;
const lead: Lead = { email: "sam@example.com", name: "Sam Rivera", stage: "Confirmed", stageAt: "2026-11-01T00:00:00Z", firstAt: "2026-11-01T00:00:00Z", lastAt: "2026-11-01T00:00:00Z", unread: false, when: "2026-12-05T18:00:00Z", quote: 1200, licence: { use: "Web and social", end: "2027-12-31" }, events: [] };

beforeEach(async () => {
  kv = new FakeKV();
  client = new FakeEmail();
  hello = new FakeEmail();
  ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY, CLIENT_EMAIL: client, EMAIL: hello, PUBLIC_WRITE_LIMIT: { limit: async () => ({ success: true }) } };
  await writeLead(kv as never, await seal(), LEAD, lead, null);
});

const admin = (method: string, body?: unknown, query = "") =>
  new Request(`https://juliangigola.com/api/contract${query}`, { method, headers: { "x-admin-key": KEY }, ...(body ? { body: JSON.stringify(body) } : {}) });
const made = async () => (await (await POST(admin("POST", { lead: LEAD }))).json()) as { contract: Contract; url: string };
// The desk fills the "to be set" lines before sending; the tests do the same.
const make = async () => { const o = await made(); return { ...o, contract: { ...o.contract, text: o.contract.text.replace(/to be set/gi, "agreed") } }; };
const send = async (c: Contract, extra: Record<string, unknown> = {}) => PATCH(admin("PATCH", { id: c.id, to: c.to, text: c.text, send: "mail", ...extra }));
const MARK = "M40 120 Q80 60 120 110 Q160 150 200 90 L240 100";
// A drawn mark unless the test says otherwise.
const signReq = (id: string, body: Record<string, unknown>) => SIGN(new Request(`https://juliangigola.com/api/contract/${id}`, { method: "POST", headers: { "cf-connecting-ip": "203.0.113.9", "user-agent": "Test UA" }, body: JSON.stringify({ mark: MARK, ...body }) }), { params: Promise.resolve({ id }) });

describe("/api/contract", () => {
  it("refuses without the admin key", async () => {
    const res = await GET(new Request("https://juliangigola.com/api/contract?templates"));
    expect(res.status).toBe(401);
  });

  it("fills a template from the lead and stores a sealed draft with a strong id", async () => {
    const { contract: c, url } = await make();
    expect(c.id).toMatch(/^[0-9A-Za-z]{16}$/);
    expect(url).toBe(`https://juliangigola.com/contract/${c.id}`);
    expect(c.text).toContain("Sam Rivera");
    expect(c.text).toContain("$1,200");
    expect(c.text).toContain("$100");
    expect(c.text).toContain("Web and social, until December 31, 2027");
    expect(c.to).toEqual({ name: "Sam Rivera", email: "sam@example.com" });
    // Sealed: the name and email never sit in KV in the clear. Both hold characters
    // base64 never makes (a space, "@"), so random ciphertext cannot match them.
    const raw = String(kv.data.get(`contract:${c.id}`)!.value);
    expect(raw).not.toContain("Sam Rivera");
    expect(raw).not.toContain("sam@example.com");
    expect((await (await GET(admin("GET", undefined, `?lead=${LEAD}`))).json()).contract.id).toBe(c.id);
  });

  it("says a lead it cannot open is broken, not gone", async () => {
    kv.data.get(`lead:${LEAD}`)!.value = "not-sealed";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(admin("POST", { lead: LEAD }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("cannot be opened");
    expect((await POST(admin("POST", { lead: "nobody" }))).status).toBe(404);
  });

  it("says a contract it cannot open is broken, not gone, everywhere it is read", async () => {
    const { contract: c } = await make();
    expect(await readContract(kv as never, await seal(), "B".repeat(16))).toBeNull();
    kv.data.get(`contract:${c.id}`)!.value = "not-sealed";
    await expect(readContract(kv as never, await seal(), c.id)).rejects.toThrow();
    // vitest 4 reuses an earlier test's console spy, so count from here
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    log.mockClear();
    for (const res of [
      await GET(admin("GET", undefined, `?lead=${LEAD}`)),
      await GET(admin("GET", undefined, `?copy=${c.id}`)),
      await POST(admin("POST", { lead: LEAD })),
      await send(c),
    ]) {
      expect(res.status).toBe(500);
      expect((await res.json()).error).toContain("cannot be opened");
    }
    const signed = await signReq(c.id, { name: "Sam Rivera", email: "sam@example.com", agree: true, hash: "x" });
    expect(signed.status).toBe(500);
    expect((await signed.json()).error).toBe("This contract is not available.");
    expect(log).toHaveBeenCalledTimes(5);
  });

  it("uses his saved templates", async () => {
    await PUT(admin("PUT", { templates: [{ id: "x", name: "Short", body: "{client} pays {fee}." }] }));
    const { contract: c } = await make();
    expect(c.text).toBe("Sam Rivera pays $1,200.");
  });

  it("refuses to send while a line is still to be set", async () => {
    const { contract: c } = await made();
    const res = await PATCH(admin("PATCH", { id: c.id, to: c.to, text: c.text, send: "mail" }));
    expect(res.status).toBe(400);
    expect(client.sent.length).toBe(0);
  });

  it("sends: mails the link, marks the lead's contract Sent, and opens the page", async () => {
    const { contract: c } = await make();
    const res = await send({ ...c, text: `${c.text}\n\nEdited.` });
    expect(res.status).toBe(200);
    expect(client.sent).toHaveLength(1);
    expect(String(client.sent[0].text)).toContain(`/contract/${c.id}`);
    expect((await readLead(kv as never, await seal(), LEAD))!.contract).toBe("Sent");
    const stored = (await readContract(kv as never, await seal(), c.id))!;
    expect(stored.sentAt).toBeTruthy();
    expect(stored.text.endsWith("Edited.")).toBe(true);
  });

  it("wants a first and last name and a drawn mark, or the typed name by choice", async () => {
    const { contract: c } = await make();
    await send(c);
    const hash = await sha256Hex(c.text);
    const base = { email: "sam@example.com", agree: true, hash };
    expect((await signReq(c.id, { ...base, name: "hi" })).status).toBe(400);
    expect((await signReq(c.id, { ...base, name: "Sam Rivera", mark: undefined })).status).toBe(400);
    expect((await signReq(c.id, { ...base, name: "Sam Rivera", mark: '"/><script>alert(1)</script>' })).status).toBe(400);
    expect((await signReq(c.id, { ...base, name: "Sam Rivera", mark: undefined, typed: true })).status).toBe(200);
    const stored = (await readContract(kv as never, await seal(), c.id))!;
    expect(stored.signed).toMatchObject({ name: "Sam Rivera", typed: true });
    expect(stored.signed!.mark).toBeUndefined();
  });

  it("will not sign a draft that was never sent", async () => {
    const { contract: c } = await make();
    const res = await signReq(c.id, { name: "Sam Rivera", email: "sam@example.com", agree: true, hash: await sha256Hex(c.text) });
    expect(res.status).toBe(404);
  });

  it("signs once: stores who, when and the text hash, locks the text, updates the lead and mails both", async () => {
    const { contract: c } = await make();
    await send(c);
    const hash = await sha256Hex(c.text);
    expect((await signReq(c.id, { name: "Sam Rivera", email: "sam@example.com", agree: false, hash })).status).toBe(400);
    const res = await signReq(c.id, { name: "Sam Rivera", email: "sam@example.com", agree: true, hash });
    expect(res.status).toBe(200);
    const stored = (await readContract(kv as never, await seal(), c.id))!;
    expect(stored.signed).toMatchObject({ name: "Sam Rivera", email: "sam@example.com", ip: "203.0.113.9", ua: "Test UA", hash, mark: "M40 120 Q80 60 120 110 Q160 150 200 90 L240 100" });
    expect(stored.signed!.hash).toBe(await sha256Hex(stored.text));
    const l = (await readLead(kv as never, await seal(), LEAD))!;
    expect(l.contract).toBe("Signed");
    expect(l.events.at(-1)).toMatchObject({ kind: "contract", ref: `signed:${c.id}` });
    expect(client.sent.at(-1)!.subject).toBe("Contract signed");
    const files = (client.sent.at(-1)!.attachments as { filename: string; disposition: string; content: Uint8Array }[]).filter((a) => a.disposition === "attachment");
    expect(files.map((f) => f.filename)).toEqual(["Contract - Sam Rivera.html"]);
    expect(new TextDecoder().decode(files[0].content)).toContain("<svg");
    expect(hello.sent.at(-1)!.subject).toBe("Signed: Sam Rivera");

    // A second signature, and any edit, are refused.
    expect((await signReq(c.id, { name: "Someone Else", email: "x@example.com", agree: true, hash })).status).toBe(409);
    expect((await send({ ...stored, text: "New terms." })).status).toBe(409);
    expect((await readContract(kv as never, await seal(), c.id))!.signed!.name).toBe("Sam Rivera");
  });

  it("refuses a signature on text that changed since the page loaded", async () => {
    const { contract: c } = await make();
    await send(c);
    const old = await sha256Hex(c.text);
    await send({ ...c, text: `${c.text} Changed.` });
    const res = await signReq(c.id, { name: "Sam Rivera", email: "sam@example.com", agree: true, hash: old });
    expect(res.status).toBe(409);
    expect((await readContract(kv as never, await seal(), c.id))!.signed).toBeUndefined();
  });

  it("serves the signed copy as an escaped attachment", async () => {
    const { contract: c } = await make();
    await send(c);
    await signReq(c.id, { name: "<img src=x onerror=alert(1)>", email: "sam@example.com", agree: true, hash: await sha256Hex(c.text) });
    const res = await GET(admin("GET", undefined, `?copy=${c.id}`));
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const html = await res.text();
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&#60;img");
  });
});

describe("fillContract / signedCopy", () => {
  it("leaves readable blanks when the lead has no date or quote", () => {
    expect(fillContract("{date} {fee}", { name: "A" })).toBe("to be set to be set");
  });
  it("shows the record on the copy", () => {
    const c = { id: "AbCdEfGh12345678", lead: LEAD, to: { name: "A", email: "a@example.com" }, text: "T", createdAt: "", updatedAt: "", signed: { name: "A", email: "a@example.com", ip: "1.2.3.4", ua: "UA", at: "2026-11-15T20:00:00Z", hash: "f".repeat(64) } } as Contract;
    expect(signedCopy(c)).toContain("f".repeat(64));
  });
});
