import { beforeEach, describe, expect, it, vi } from "vitest";
import { CURSOR, mailChanges, syncGmail, type Msg } from "./gmail-sync";
import { forgetToken } from "./gcal";
import { fold, leadKey, recordLead, type Lead } from "./leads";
import { sealer } from "./lead-crypto";

const at = (h: number) => new Date(Date.UTC(2026, 10, 2, h)).toISOString();
const email = "maya@example.com";
const msg = (id: string, labels: string[], from: string, to: string, subject = "Re: portraits"): Msg => ({
  id,
  labelIds: labels,
  internalDate: String(Date.parse(at(5))),
  payload: { headers: [{ name: "From", value: from }, { name: "To", value: to }, { name: "Subject", value: subject }] },
});

describe("fold, Gmail kinds", () => {
  const inquiry = () => fold(null, email, { event: { at: at(1), kind: "inquiry", ref: "msg:1" }, name: "Maya" });

  it("his reply moves an Inquiry to Replied and off Needs me, once per message", () => {
    const l = fold(inquiry(), email, { event: { at: at(2), kind: "replied", ref: "g1", note: "Re: portraits" } });
    expect(l).toMatchObject({ stage: "Replied", stageAt: at(2), unread: false, lastAt: at(1) });
    expect(fold(l, email, { event: { at: at(2), kind: "replied", ref: "g1" } })).toBe(l);
  });

  it("his reply never moves a later stage back", () => {
    let l = fold(inquiry(), email, { event: { at: at(2), kind: "stage" }, stage: "Quoted" });
    l = fold(l, email, { event: { at: at(3), kind: "replied", ref: "g1" } });
    expect(l).toMatchObject({ stage: "Quoted", stageAt: at(2) });
  });

  it("their answer is news: unread, unsnoozed, out of Archived, stage kept", () => {
    let l = fold(inquiry(), email, { event: { at: at(2), kind: "replied", ref: "g1" } });
    l = fold(l, email, { event: { at: at(3), kind: "archive" }, on: true });
    l = fold(l, email, { event: { at: at(4), kind: "wrote", ref: "g2" } });
    expect(l).toMatchObject({ stage: "Replied", unread: true, lastAt: at(4) });
    expect(l.archivedAt).toBeUndefined();
  });
});

describe("mailChanges", () => {
  it("reads sent mail as replied to each outside recipient", () => {
    const out = mailChanges(msg("g1", ["SENT"], "Julian <hello@juliangigola.com>", "Maya <Maya@Example.com>, book@juliangigola.com"));
    expect(out).toEqual([{ email, c: { event: { at: at(5), ref: "g1", note: "Re: portraits", kind: "replied" } } }]);
  });

  it("reads received mail as wrote, with the sender's name", () => {
    const [{ email: e, c }] = mailChanges(msg("g2", ["INBOX"], '"Maya Lee" <maya@example.com>', "hello@juliangigola.com"));
    expect(e).toBe(email);
    expect(c).toMatchObject({ event: { kind: "wrote", ref: "g2" }, name: "Maya Lee" });
  });

  it("skips drafts, spam and the site's own notifications", () => {
    expect(mailChanges(msg("d", ["DRAFT"], "hello@juliangigola.com", email))).toEqual([]);
    expect(mailChanges(msg("s", ["SPAM"], email, "hello@juliangigola.com"))).toEqual([]);
    expect(mailChanges(msg("n", ["INBOX"], "notifications@juliangigola.com", "hello@juliangigola.com"))).toEqual([]);
  });
});

describe("syncGmail", () => {
  const LEADS_KEY = btoa("k".repeat(32));
  const GCAL_OAUTH = JSON.stringify({ client_id: "id", client_secret: "shh", refresh_token: "rt" });
  let data: Map<string, string>;
  let calls: string[];
  let historyStatus: number;
  const kv = () => ({
    get: async (k: string) => data.get(k) ?? null,
    put: async (k: string, v: string) => void data.set(k, v),
    list: async () => ({ keys: [] }),
    delete: async (k: string) => void data.delete(k),
  });
  const env = () => ({ INBOX: kv() as never, LEADS_KEY, GCAL_OAUTH });
  const MAIL: Record<string, Msg> = {
    a: msg("a", ["SENT"], "hello@juliangigola.com", email),
    b: msg("b", ["INBOX"], "Maya <maya@example.com>", "hello@juliangigola.com"),
    c: msg("c", ["INBOX"], "news@shop.com", "hello@juliangigola.com"),
  };

  beforeEach(() => {
    forgetToken();
    data = new Map();
    calls = [];
    historyStatus = 200;
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      if (url.startsWith("https://oauth2")) return Response.json({ access_token: "at", expires_in: 3599 });
      if (url.endsWith("/profile")) return Response.json({ historyId: "900" });
      if (url.includes("/history?")) {
        if (historyStatus !== 200) return Response.json({ error: { message: "gone" } }, { status: historyStatus });
        return Response.json({
          historyId: "120",
          history: [
            { id: "101", messagesAdded: [{ message: { id: "a", labelIds: ["SENT"] } }] },
            { id: "102", messagesAdded: [{ message: { id: "b", labelIds: ["INBOX"] } }, { message: { id: "c", labelIds: ["INBOX"] } }] },
            { id: "103", messagesAdded: [{ message: { id: "x", labelIds: ["DRAFT"] } }] },
          ],
        });
      }
      const id = /messages\/(\w+)\?/.exec(url)![1];
      return Response.json(MAIL[id]);
    });
  });

  it("starts from now on the first run, folding nothing", async () => {
    expect(await syncGmail(env())).toBe(0);
    expect(data.get(CURSOR)).toBe("900");
  });

  it("folds his reply and their answer into an existing lead only, and moves the cursor", async () => {
    const e = env();
    await recordLead(e, email, { event: { at: at(1), kind: "inquiry", ref: "msg:1" }, name: "Maya" });
    data.set(CURSOR, "100");
    expect(await syncGmail(e)).toBe(2);
    const s = await sealer(LEADS_KEY)!;
    const lead = await s.open<Lead>(data.get(leadKey(await s.id(email)))!);
    expect(lead.events.map((x) => [x.kind, x.ref])).toEqual([["inquiry", "msg:1"], ["replied", "a"], ["wrote", "b"]]);
    expect(lead).toMatchObject({ stage: "Replied", unread: true });
    // news@shop.com is no lead and never becomes one; the draft is never fetched.
    expect(data.has(leadKey(await s.id("news@shop.com")))).toBe(false);
    expect(calls.some((u) => u.includes("messages/x"))).toBe(false);
    expect(data.get(CURSOR)).toBe("120");
  });

  it("starts again from now when Gmail no longer has the cursor", async () => {
    data.set(CURSOR, "1");
    historyStatus = 404;
    expect(await syncGmail(env())).toBe(0);
    expect(data.get(CURSOR)).toBe("900");
  });
});
