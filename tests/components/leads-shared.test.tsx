import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { kindOf, label, mailto, Tag } from "@/components/leads/shared";
import { cash, matches, money, nextStep, pass } from "@/lib/leads/lead-desk";
import type { LeadSummary } from "@/lib/leads/leads";

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
    expect(pass(lead(), "open")).toBe(true);
    expect(pass(lead({ stage: "Lost" }), "open")).toBe(false);
    expect(pass(lead({ trashedAt: iso }), "trash")).toBe(true);
    expect(pass(lead({ trashedAt: iso }), "open")).toBe(false);
    expect(pass(lead({ archivedAt: iso }), "archived")).toBe(true);
    expect(pass(lead({ when: new Date(Date.now() + 864e5).toISOString(), stage: "Confirmed" }), "upcoming")).toBe(true);
    expect(pass(lead({ unread: true }), "needs")).toBe(true);
  });

  it("formats money, cash, labels and kinds", () => {
    expect(money(1500.4)).toBe("$1,500");
    expect(cash(-12345)).toBe("−$123.45");
    expect(label("needs")).toBe("Your move");
    expect(label("Quoted")).toBe("Quoted");
    expect(kindOf("intro-call")).toBe("Intro call");
  });

  it("mailto quotes their message", () => {
    const url = mailto("a@x.com", "Hi", "Thanks", { name: "Ana", at: iso, text: "Can we shoot?" });
    expect(url.startsWith("mailto:a@x.com?")).toBe(true);
    expect(decodeURIComponent(url)).toContain("> Can we shoot?");
  });

  it("Tag renders its mark and words", () => {
    render(<Tag tone="needs" mark="o">Reply</Tag>);
    expect(screen.getByText("Reply").textContent).toBe("oReply");
  });
});
