import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordLead } from "@/lib/leads/lead-store";
import { sealer } from "@/lib/leads/lead-crypto";
import { readLog } from "@/lib/leads/activity-log";
import { importStripe } from "@/lib/leads/stripe-import";
import { FakeKV, LEADS_KEY, leadOf } from "./fakes";

/* Past Stripe payments onto the log (`lib/leads/stripe-import.ts`), against a fake Stripe. */

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => { throw new Error("no worker"); } }));

const T = Date.UTC(2026, 5, 1) / 1000;
const deposit = (n: number, email: string) => ({ id: `pi_dep${String(n).padStart(6, "0")}`, status: "succeeded", created: T + n, amount: 10000, amount_received: 10000, currency: "usd", receipt_email: email, metadata: { kind: "deposit", email, name: "Ana Test" }, latest_charge: null });
const other = (n: number, email: string, cents: number) => ({ id: `pi_oth${String(n).padStart(6, "0")}`, status: "succeeded", created: T + n, amount: cents, amount_received: cents, currency: "usd", description: "Invoice 0626", receipt_email: null, metadata: {}, latest_charge: { billing_details: { email, name: "Bo Test" } } });

let intents: object[];
let refunds: object[];
let calls: string[];
/** Stripe's list paging: `limit` a page, `starting_after` the last id seen. */
function page(list: { id: string }[], url: URL) {
  const limit = Number(url.searchParams.get("limit"));
  const after = url.searchParams.get("starting_after");
  const from = after ? list.findIndex((x) => x.id === after) + 1 : 0;
  return { data: list.slice(from, from + limit), has_more: from + limit < list.length };
}
let kv: FakeKV;
const env = () => ({ INBOX: kv as never, LEADS_KEY });
beforeEach(() => {
  kv = new FakeKV();
  calls = [];
  intents = [];
  refunds = [];
  vi.stubGlobal("fetch", async (input: string) => {
    const url = new URL(input);
    calls.push(url.pathname + url.search);
    const list = url.pathname.endsWith("/payment_intents") ? intents : url.pathname.endsWith("/refunds") ? refunds : null;
    return new Response(JSON.stringify(list ? page(list as { id: string }[], url) : {}), { status: list ? 200 : 404 });
  });
});
afterEach(() => vi.unstubAllGlobals());

const logOf = async (email: string) => {
  const s = (await sealer(LEADS_KEY))!;
  return readLog(kv as never, s, await s.id(email));
};

describe("importStripe", () => {
  it("pages every list and only counts on a dry run", async () => {
    intents = Array.from({ length: 230 }, (_, i) => deposit(i, `p${i % 3}@example.com`));
    const c = await importStripe(env(), "sk_test_fake", true);
    expect(calls.filter((u) => u.startsWith("/v1/payment_intents"))).toHaveLength(3);
    expect(c).toMatchObject({ dry: true, payments: 230, refunds: 0, already: 0, people: 3 });
    expect(await leadOf(kv, "p0@example.com")).toBeUndefined();
  });

  it("records payments and refunds with the live refs, and a second run adds nothing", async () => {
    intents = [deposit(1, "ana@example.com"), other(2, "bo@example.com", 50000), { ...other(3, "cy@example.com", 9000), metadata: { proof: "tok" } }, { ...deposit(4, "ana@example.com"), status: "canceled" }];
    refunds = [
      { id: "re_1", status: "succeeded", created: T + 10, amount: 10000, payment_intent: deposit(1, "").id },
      { id: "re_2", status: "succeeded", created: T + 11, amount: 20000, payment_intent: other(2, "", 0).id },
    ];
    const c = await importStripe(env(), "sk_test_fake", false);
    expect(c).toMatchObject({ payments: 2, refunds: 2, already: 0 });
    const ana = await logOf("ana@example.com");
    expect(ana.map((e) => [e.kind, e.ref, e.amount])).toEqual([["payment", deposit(1, "").id, 100], ["refund", `refund-${deposit(1, "").id}`, 100]]);
    const bo = await logOf("bo@example.com");
    expect(bo.map((e) => e.ref)).toEqual([other(2, "", 0).id, `refund-${other(2, "", 0).id}-20000`]);
    // An old payment is a line on the log, not news.
    expect((await leadOf(kv, "bo@example.com"))!.name).toBe("Bo Test");
    expect(await logOf("cy@example.com")).toEqual([]);
    expect(await importStripe(env(), "sk_test_fake", true)).toMatchObject({ payments: 0, refunds: 0, already: 4 });
  });

  it("skips what the live webhook already logged, even past the lead's last 50 events", async () => {
    const pi = deposit(1, "ana@example.com");
    await recordLead(env(), "ana@example.com", { event: { at: new Date().toISOString(), kind: "payment", ref: pi.id, note: "Deposit", amount: 100 } });
    for (let i = 0; i < 55; i++) await recordLead(env(), "ana@example.com", { event: { at: new Date().toISOString(), kind: "wrote", ref: `g${i}` } });
    intents = [pi];
    expect(await importStripe(env(), "sk_test_fake", false)).toMatchObject({ payments: 0, already: 1 });
    expect((await logOf("ana@example.com")).filter((e) => e.kind === "payment")).toHaveLength(1);
  });

  it("leaves an archived lead archived", async () => {
    const l = await recordLead(env(), "ana@example.com", { event: { at: new Date().toISOString(), kind: "archive" }, on: true });
    expect(l!.archivedAt).toBeTruthy();
    intents = [deposit(1, "ana@example.com")];
    await importStripe(env(), "sk_test_fake", false);
    expect((await leadOf(kv, "ana@example.com"))!.archivedAt).toBe(l!.archivedAt);
  });
});
