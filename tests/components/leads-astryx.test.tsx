import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeadsAstryx } from "@/components/admin/leads/leads-astryx";

afterEach(() => vi.unstubAllGlobals());

const iso = new Date().toISOString();
const lead = { id: "a", email: "ana@x.com", name: "Ana", stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso, unread: true, snippet: "Hi" };

describe("LeadsAstryx", () => {
  it("loads the leads into Your move", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("templates") ? { templates: [] } : { leads: [lead] }), { status: 200 }))),
    );
    render(<LeadsAstryx />);
    expect(await screen.findByRole("heading", { level: 1, name: "Leads" })).toBeTruthy();
    expect((await screen.findAllByText("Ana")).length).toBeGreaterThan(0);
    expect(screen.getByText(/YOUR MOVE/)).toBeTruthy();
  });

  it("asks for the key when the desk is not authorized", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: "Not authorized." }), { status: 401 }))));
    render(<LeadsAstryx />);
    expect(await screen.findByRole("textbox")).toBeTruthy();
  });
});
