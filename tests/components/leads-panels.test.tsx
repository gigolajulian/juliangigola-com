import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { About, about, Next } from "@/components/leads/row";
import { People } from "@/components/leads/people";
import { Galleries } from "@/components/leads/galleries";
import { SignIn, swScope } from "@/components/leads/setup";
import { InvoicesDesk, status, type InvoiceRow as Row } from "@/components/leads/invoices";
import { InvoiceRow } from "@/components/leads/invoice";
import { ContractBlock, ContractTemplatesDesk } from "@/components/leads/contract";
import type { Call } from "@/lib/leads/lead-desk";
import type { Lead, LeadSummary, Person } from "@/lib/leads/leads";
import type { Row as ProofRow } from "@/lib/proofs/desk";

afterEach(() => vi.unstubAllGlobals());

const iso = new Date().toISOString();
const lead = (id: string, extra: Partial<LeadSummary> = {}) => ({ id, email: `${id}@x.com`, name: id, stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso, ...extra }) as LeadSummary;
const json = (o: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status }));

describe("row", () => {
  it("joins only the parts there are", () => {
    expect(about(["Consultation", null, "", "Call booked", undefined, false])).toBe("Consultation · Call booked");
    render(<About>{about(["Portraits", "Quoted"])}</About>);
    expect(screen.getByText("Portraits · Quoted")).toBeTruthy();
  });

  it("puts stuck money ahead of the next step", () => {
    render(<Next l={lead("a", { flags: ["stuck"] } as never)} />);
    expect(screen.getByText(/Deposit stuck/)).toBeTruthy();
    expect(screen.queryByText(/Refund or rebook/)).toBeNull();
  });

  it("shows Reply on a fresh inquiry", () => {
    render(<Next l={lead("a")} />);
    expect(screen.getByText("Reply →")).toBeTruthy();
  });
});

describe("People", () => {
  const ana: Person = { name: "Ana Ruiz", email: "ana@studio.com", role: "Art director", phone: "408 555 0100" };

  it("adds a person and sends the whole list up", async () => {
    const onSave = vi.fn(async (_: Person[]) => {});
    render(<People people={[ana]} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a person" }));
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "bo@studio.com" } });
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Bo" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toEqual([ana, { name: "Bo", email: "bo@studio.com", role: "", phone: "" }]);
  });

  it("removes a person and shows why a save failed", async () => {
    const onSave = vi.fn(async (_: Person[]) => { throw new Error("KV down"); });
    render(<People people={[ana]} onSave={onSave} />);
    expect(screen.getByText("ana@studio.com · 408 555 0100")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onSave.mock.calls[0][0]).toEqual([]);
    expect((await screen.findByRole("alert")).textContent).toBe("KV down");
  });
});

describe("Galleries", () => {
  const proof = (extra: Partial<ProofRow>) => ({ token: "t1", name: "Ana portraits", frames: Array(48).fill({}), selects: [], url: "/p/t1", ...extra }) as unknown as ProofRow;

  it("says where each gallery stands and who it went to", () => {
    const open = vi.fn();
    render(<Galleries lead="ana@x.com" open={open} galleries={[
      proof({ token: "t1", views: 3 }),
      proof({ token: "t2", name: "Ana finals", deliveredAt: iso, finals: [{}, {}] as never, email: "ad@studio.com" }),
    ]} />);
    expect(screen.getByText("Proofs · 48 frames · not sent · opened 3 times")).toBeTruthy();
    expect(screen.getByText(/^Finals · 2 photos · delivered .* · to ad@studio.com$/)).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByText("Delivered")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Open" })[1]);
    expect(open).toHaveBeenCalledWith("t2");
    fireEvent.click(screen.getByRole("button", { name: "All proofs" }));
    expect(open).toHaveBeenLastCalledWith();
  });
});

describe("SignIn", () => {
  it("hands up the trimmed key, never an empty one", () => {
    const onKey = vi.fn();
    render(<SignIn onKey={onKey} wrong={false} />);
    const box = screen.getByLabelText("Inbox key or GitHub token");
    fireEvent.change(box, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Open leads" }));
    expect(onKey).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "  ghp_test  " } });
    fireEvent.click(screen.getByRole("button", { name: "Open leads" }));
    expect(onKey).toHaveBeenCalledWith("ghp_test");
    expect(screen.queryByText(/not accepted/)).toBeNull();
  });

  it("says when the key was refused, and scopes the worker to the desk", () => {
    render(<SignIn onKey={() => {}} wrong />);
    expect(screen.getByText("That was not accepted. Paste it again.")).toBeTruthy();
    expect(swScope()).toBe("/admin/leads");
  });
});

const inv = (no: string, extra: Partial<Row> = {}): Row => ({ no, date: "2026-11-16", lines: [{ desc: "Portraits", qty: 1, rate: 900 }], paid: 100, at: "2026-11-16T20:00:00Z", lead: "a", name: "Ana Ruiz", ...extra });

describe("InvoicesDesk", () => {
  it("reads paid, sent and unpaid, and totals what is owed", async () => {
    expect(status(inv("1", { paidAt: iso }))).toBe("Paid");
    expect(status(inv("1", { at: "2026-10-01T00:00:00Z" }))).toBe("Paid"); // before the log, counts paid
    expect(status(inv("1", { sentAt: iso }))).toBe("Sent");
    expect(status(inv("1"))).toBe("Unpaid");

    const call = vi.fn(async () => ({ invoices: [inv("1126"), inv("1126-2", { paidAt: iso }), inv("1026", { lead: "gone" })] })) as unknown as Call;
    render(<InvoicesDesk leads={[lead("a", { name: "Ana Ruiz" })]} call={call} open={() => {}} changed={() => {}} />);
    expect(await screen.findByText("3 ON THE DESK · $1,600.00 UNPAID")).toBeTruthy();
    expect(screen.getByText("1126-2")).toBeTruthy();
    // The invoice whose lead is gone cannot open.
    const opens = screen.getAllByRole("button", { name: "Open" }) as HTMLButtonElement[];
    expect(opens.filter((b) => b.disabled || b.getAttribute("aria-disabled") === "true")).toHaveLength(1);
  });

  it("says so when there are none", async () => {
    const call = vi.fn(async () => ({ invoices: [] })) as unknown as Call;
    render(<InvoicesDesk leads={[]} call={call} open={() => {}} changed={() => {}} />);
    expect(await screen.findByText(/No invoices yet/)).toBeTruthy();
  });
});

describe("InvoiceRow", () => {
  it("shows what is due and refuses a PDF until his details are in", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ from: null })));
    const l = lead("a", { name: "Ana Ruiz" });
    render(<ul><InvoiceRow inv={inv("1126")} l={l} full={{ ...l, events: [] } as unknown as Lead} /></ul>);
    expect(screen.getByText(/\$800\.00 due/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Add your details for invoices first.");
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe("/api/inbox?invoiceFrom");
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
