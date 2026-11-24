import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InvoiceRow } from "@/components/leads/invoice";
import { ContractBlock, ContractTemplatesDesk } from "@/components/leads/contract";
import type { Lead } from "@/lib/leads/leads";
import { inv, iso, json, lead } from "./leads-fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("InvoiceRow", () => {
  it("shows what is due and refuses a PDF until his details are in", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ from: null })));
    const l = lead("a", { name: "Ana Ruiz" });
    render(<ul><InvoiceRow inv={inv("1126")} l={l} full={{ ...l, events: [] } as unknown as Lead} /></ul>);
    expect(screen.getByText(/\$800\.00 due/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Add your details for invoices first.");
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe("/api/leads/invoice-from");
  });
});

describe("ContractBlock", () => {
  const draft = { id: "k1", lead: "lead:a", to: { name: "Ana Ruiz", email: "ana@x.com" }, text: "Between Julian Gigola and Ana Ruiz.", createdAt: iso, updatedAt: iso };

  function stub(contract: unknown) {
    const fetch = vi.fn((url: string, init: RequestInit = {}) => {
      if (url.includes("?templates")) return json({ templates: [{ id: "shoot", name: "Shoot", body: "x" }] });
      if (init.method === "POST") return json({ contract: draft, url: null });
      if (init.method === "PATCH") return json({ contract: { ...draft, ...JSON.parse(String(init.body)), sentAt: iso }, url: "https://juliangigola.com/c/k1" });
      return json({ contract, url: null });
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  it("makes a contract from the template, then sends it", async () => {
    const fetch = stub(null);
    const changed = vi.fn();
    render(<ContractBlock leadId="a" changed={changed} />);
    fireEvent.click(await screen.findByRole("button", { name: "Make contract" }));
    const post = await waitFor(() => fetch.mock.calls.find(([, i]) => i?.method === "POST")!);
    expect(JSON.parse(String(post[1]!.body))).toEqual({ lead: "a", template: "shoot" });
    fireEvent.click(await screen.findByRole("button", { name: "Send" }));
    expect(await screen.findByText("Sent to ana@x.com.")).toBeTruthy();
    expect(changed).toHaveBeenCalled();
    const patch = fetch.mock.calls.find(([, i]) => i?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toMatchObject({ id: "k1", send: "mail", to: draft.to });
  });

  it("shows who signed and when", async () => {
    stub({ ...draft, sentAt: iso, signed: { name: "Ana Ruiz", at: iso, hash: "ab".repeat(32) } });
    render(<ContractBlock leadId="a" changed={() => {}} />);
    expect(await screen.findByText(/^Signed by Ana Ruiz, /)).toBeTruthy();
    expect(screen.getByText(`SHA-256 ${"ab".repeat(8)}`)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download signed copy" })).toBeTruthy();
  });

  it("shows the route's error when the lead's contract fails to load", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ error: "Unauthorized" }, 401)));
    render(<ContractBlock leadId="a" changed={() => {}} />);
    expect(await screen.findByText("Unauthorized")).toBeTruthy();
  });
});

describe("ContractBlock templates", () => {
  it("says the templates did not load under Make contract", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.endsWith("?templates") ? json({ error: "Down." }, 500) : json({ contract: null, url: null }))));
    render(<ContractBlock leadId="a" changed={() => {}} />);
    expect(await screen.findByText("Contract templates did not load.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Make contract" })).toBeTruthy();
  });
});

describe("ContractTemplatesDesk", () => {
  it("adds a template and saves the list with PUT", async () => {
    const fetch = vi.fn((_: string, init: RequestInit = {}) => (init.method === "PUT" ? json(JSON.parse(String(init.body))) : json({ templates: [{ id: "shoot", name: "Shoot", body: "x" }] })));
    vi.stubGlobal("fetch", fetch);
    render(<ContractTemplatesDesk />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a contract" }));
    fireEvent.click(screen.getByRole("button", { name: "Save contracts" }));
    expect(await screen.findByText("Saved.")).toBeTruthy();
    const put = fetch.mock.calls.find(([, i]) => i?.method === "PUT")!;
    expect(JSON.parse(String(put[1]!.body)).templates.map((t: { name: string }) => t.name)).toEqual(["Shoot", "New contract"]);
  });
});
