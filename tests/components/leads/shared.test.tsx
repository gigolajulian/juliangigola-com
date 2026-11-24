import { afterEach, describe, expect, it, vi } from "vitest";
import { filterLabel, kindOf, mailto } from "@/components/leads/shared";
import { centsLabel, matches, dollarsLabel, nextStep, inFilter } from "@/lib/leads/lead-desk";
import { adminCall } from "@/lib/admin/admin-call";
import type { LeadSummary } from "@/lib/leads/leads";

describe("adminCall", () => {
  afterEach(() => vi.unstubAllGlobals());
  const answer = (body: string, status: number) => vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));

  it("hands back the JSON of a 2xx", async () => {
    answer('{"rows":[]}', 200);
    expect(await adminCall("/api/inbox")).toEqual({ rows: [] });
  });

  it("throws on a 2xx that is not JSON", async () => {
    answer("<html>", 200);
    await expect(adminCall("/api/inbox")).rejects.toMatchObject({ message: "The route did not answer with JSON.", status: 200 });
  });

  it("reports the status of a failed answer that is not JSON, or the route's own error", async () => {
    answer("<html>502</html>", 502);
    await expect(adminCall("/api/inbox")).rejects.toMatchObject({ message: "Request failed (502)", status: 502 });
    answer('{"error":"Not authorized."}', 401);
    await expect(adminCall("/api/inbox")).rejects.toMatchObject({ message: "Not authorized.", status: 401 });
  });
});

const iso = new Date().toISOString();
const lead = (o: Partial<LeadSummary> = {}): LeadSummary => ({ id: "a", email: "ana@x.com", name: "Ana", stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso, unread: false, ...o });

describe("leads/shared", () => {
  it("matches searches name, email, kind and snippet", () => {
    const l = lead({ kind: "portraits", snippet: "Hello there" });
    expect(matches(l, "")).toBe(true);
    expect(matches(l, "ana@")).toBe(true);
    expect(matches(l, "hello")).toBe(true);
    expect(matches(l, "wedding")).toBe(false);
  });

  it("nextStep names the move", () => {
    expect(nextStep(lead())).toBe("Reply");
    expect(nextStep(lead({ flags: ["stuck"] }))).toBe("Refund or rebook");
    expect(nextStep(lead({ flags: ["no-deposit"] }))).toBe("Ask for the deposit");
  });

  it("pass sorts leads into the desk lists", () => {
    expect(inFilter(lead(), "open")).toBe(true);
    expect(inFilter(lead({ stage: "Lost" }), "open")).toBe(false);
    expect(inFilter(lead({ trashedAt: iso }), "trash")).toBe(true);
    expect(inFilter(lead({ trashedAt: iso }), "open")).toBe(false);
    expect(inFilter(lead({ archivedAt: iso }), "archived")).toBe(true);
    expect(inFilter(lead({ when: new Date(Date.now() + 864e5).toISOString(), stage: "Confirmed" }), "upcoming")).toBe(true);
    expect(inFilter(lead({ unread: true }), "needs")).toBe(true);
  });

  it("formats money, cash, labels and kinds", () => {
    expect(dollarsLabel(1500.4)).toBe("$1,500");
    expect(centsLabel(-12345)).toBe("−$123.45");
    expect(filterLabel("needs")).toBe("Your move");
    expect(filterLabel("Quoted")).toBe("Quoted");
    expect(kindOf("intro-call")).toBe("Intro call");
  });

  it("mailto quotes their message", () => {
    const url = mailto("a@x.com", "Hi", "Thanks", { name: "Ana", at: iso, text: "Can we shoot?" });
    expect(url.startsWith("mailto:a@x.com?")).toBe(true);
    expect(decodeURIComponent(url)).toContain("> Can we shoot?");
  });
});
