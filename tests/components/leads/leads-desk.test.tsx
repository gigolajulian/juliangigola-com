import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LeadsDesk } from "@/components/leads/desk";

afterEach(() => vi.unstubAllGlobals());

const iso = new Date().toISOString();
const lead = {
  id: "a",
  email: "ana@x.com",
  name: "Ana",
  stage: "Inquiry",
  stageAt: iso,
  firstAt: iso,
  lastAt: iso,
  unread: true,
  snippet: "Hi",
};

describe("LeadsDesk", () => {
  it("opens on Today with the lead under Your move, and Leads switches to the list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(new Response(JSON.stringify(url.includes("templates") ? { templates: [] } : { leads: [lead] }), { status: 200 })),
      ),
    );
    render(<LeadsDesk />);
    expect(await screen.findByRole("heading", { level: 1, name: /, Julian\./ })).toBeTruthy();
    expect((await screen.findAllByText("Ana")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText("Leads")[0]);
    expect(await screen.findByRole("heading", { level: 1, name: "Leads" })).toBeTruthy();
    expect((await screen.findAllByText("Ana")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Your move/)).toBeTruthy();
  });

  it("says which parts of Today did not load instead of showing them empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(url === "/api/leads" ? Response.json({ leads: [lead] }) : Response.json({ error: "Down." }, { status: 500 })),
      ),
    );
    render(<LeadsDesk />);
    expect(await screen.findByText("Overdue invoices did not load.")).toBeTruthy();
    expect(await screen.findByText("Gallery activity did not load.")).toBeTruthy();
  });

  it("asks for the key when the desk is not authorized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: "Not authorized." }), { status: 401 }))),
    );
    render(<LeadsDesk />);
    // By its label: a password field has no textbox role (this passed before on the search box the first test left behind).
    expect(await screen.findByLabelText(/Admin key or GitHub token/)).toBeTruthy();
  });
});
