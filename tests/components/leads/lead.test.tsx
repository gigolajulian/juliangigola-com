import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LeadDesk } from "@/components/leads/lead";
import { deskCall } from "@/lib/leads/lead-desk";
import type { Lead, LeadSummary } from "@/lib/leads/leads";

vi.mock("@/lib/leads/lead-desk", async (actual) => ({ ...(await actual<typeof import("@/lib/leads/lead-desk")>()), deskCall: vi.fn() }));
// The desk fetch, faked per test.
const call = deskCall as unknown as Mock;

afterEach(() => vi.unstubAllGlobals());

const iso = new Date().toISOString();
const summary: LeadSummary = { id: "a", email: "ana@x.com", name: "Ana Ruiz", stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso } as LeadSummary;
const full: Lead = { ...summary, events: [{ at: iso, kind: "inquiry", text: "From the form" }], notes: "Bring a stylist", quote: 1800 } as unknown as Lead;

function setup() {
  // The proofs list goes through fetch; the lead through `deskCall`.
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ proofs: [] }), { status: 200 }))));
  call.mockReset();
  call.mockImplementation(async (init?: RequestInit & { path?: string }) => {
    if (init?.method === "PATCH") return { lead: { ...full, ...JSON.parse(String(init.body)) } };
    return { lead: full };
  });
  const onChange = vi.fn();
  render(<LeadDesk summary={summary} onChange={onChange} onBack={() => {}} reload={() => {}} templates={[]} others={[]} size="wide" />);
  return { onChange };
}

describe("LeadDesk", () => {
  it("shows the lead, its reply link, quote and notes", async () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Ana Ruiz" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Reply in Gmail/ })[0].getAttribute("href")).toContain("ana%40x.com");
    expect((await screen.findAllByText("$1,800.00")).length).toBe(2); // quote and balance, no deposit
    expect((screen.getByLabelText(/Notes/) as HTMLTextAreaElement).value).toBe("Bring a stylist");
  });

  it("saves notes on blur with the same PATCH as the classic desk", async () => {
    const { onChange } = setup();
    const box = (await screen.findByDisplayValue("Bring a stylist")) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "No stylist" } });
    fireEvent.blur(box);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const patch = call.mock.calls.find(([i]) => i?.method === "PATCH")![0]!;
    expect(JSON.parse(String(patch.body))).toEqual({ key: "lead:a", notes: "No stylist" });
  });
});
