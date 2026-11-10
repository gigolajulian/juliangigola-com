import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { api, closed, LeadProofs, ProofsDesk, status, type Row } from "@/components/admin-proofs";

afterEach(() => vi.unstubAllGlobals());

const proof = (over: Partial<Row> = {}): Row => ({
  token: "tk1",
  name: "Nov 1 portraits",
  email: "ana@example.com",
  included: 10,
  price: 15,
  days: 14,
  createdAt: "2026-11-01T20:00:00Z",
  frames: [{ id: "f1", file: "DSC1.jpg", w: 100, h: 150 } as never],
  selects: [],
  notes: {},
  views: 0,
  url: "https://juliangigola.com/proof/tk1",
  ...over,
});

const answer = (body: unknown, ok = true) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })),
  );

describe("proof helpers", () => {
  it("closed and status read the gallery state", () => {
    expect(closed(proof({ closesAt: "2000-01-01T00:00:00Z" }))).toBe(true);
    expect(closed(proof())).toBe(false);
    expect(status(proof({ sentAt: "2026-11-02T00:00:00Z" }))).toBe("Sent");
    expect(status(proof({ sentAt: "x", closesAt: "2000-01-01T00:00:00Z" }))).toBe("Sent · closed");
  });

  it("api throws the server error", async () => {
    answer({ error: "nope" }, false);
    await expect(api({ query: "?list" })).rejects.toThrow("nope");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/proof?list");
  });
});

describe("ProofsDesk", () => {
  it("says when there are no galleries", async () => {
    answer({ proofs: [] });
    render(<ProofsDesk />);
    expect(screen.getByText("Loading.")).toBeTruthy();
    expect(await screen.findByText(/No galleries yet/)).toBeTruthy();
  });

  it("lists a gallery and opens its card", async () => {
    answer({ proofs: [proof()] });
    render(<ProofsDesk />);
    expect((await screen.findAllByText("Nov 1 portraits")).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 open · 0 closed/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open gallery" }).getAttribute("href")).toBe("/proof/tk1");
  });

  it("shows a load error", async () => {
    answer({ error: "Locked" }, false);
    render(<ProofsDesk />);
    expect(await screen.findByText("Locked")).toBeTruthy();
  });
});

describe("LeadProofs", () => {
  it("renders nothing for an address with no galleries", async () => {
    answer({ proofs: [proof()] });
    const { container } = render(<LeadProofs email="other@example.com" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });

  it("shows the lead's own gallery", async () => {
    answer({ proofs: [proof()] });
    render(<LeadProofs email="Ana@Example.com" />);
    expect(await screen.findByRole("region", { name: "Proofs" })).toBeTruthy();
  });
});
