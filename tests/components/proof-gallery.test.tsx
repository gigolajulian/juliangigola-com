import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProofGallery } from "@/components/proof-gallery";
import type { PublicProof } from "@/lib/proofs";

const proof = (over: Partial<PublicProof> = {}): PublicProof => ({
  frames: [
    { id: "a", w: 1200, h: 1800 },
    { id: "b", w: 1800, h: 1200 },
  ],
  selects: [],
  included: 10,
  price: 25,
  balance: 0,
  closesAt: null,
  submitted: false,
  paid: 0,
  paidPending: false,
  ...over,
});

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ picks: [] }), { status: 200 }));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

describe("ProofGallery", () => {
  // The grid wall gate is the default since #884; these cover the plain gate, kept behind ?proofwall=0.
  beforeEach(() => history.replaceState(null, "", "/?proofwall=0"));
  afterEach(() => history.replaceState(null, "", "/"));

  it("opens on the email gate", () => {
    render(<ProofGallery token="t1" initial={proof()} />);
    expect(screen.getByRole("heading", { name: "Pick your proofs." })).toBeTruthy();
    expect(screen.getByText("Proofs · 2 frames")).toBeTruthy();
  });

  it("asks for a name first", () => {
    render(<ProofGallery token="t1" initial={proof()} />);
    fireEvent.change(screen.getByPlaceholderText("you@email.com"), { target: { value: "a@b.co" } });
    fireEvent.submit(screen.getByRole("button", { name: "Open gallery" }).closest("form")!);
    expect(screen.getByRole("alert").textContent).toBe("Add your name.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an address that is not an email", () => {
    render(<ProofGallery token="t1" initial={proof()} />);
    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Maya" } });
    fireEvent.change(screen.getByPlaceholderText("you@email.com"), { target: { value: "nope" } });
    fireEvent.submit(screen.getByRole("button", { name: "Open gallery" }).closest("form")!);
    expect(screen.getByRole("alert").textContent).toMatch(/does not look right/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a name and email log the open with the name, greet by first name, and keep nothing on the device", async () => {
    render(<ProofGallery token="t1" initial={proof()} />);
    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: " Maya  Ross " } });
    fireEvent.change(screen.getByPlaceholderText("you@email.com"), { target: { value: "a@b.co" } });
    fireEvent.submit(screen.getByRole("button", { name: "Open gallery" }).closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/proof/t1", expect.objectContaining({ method: "POST" })));
    expect(JSON.parse((fetchMock.mock.calls as unknown as [string, RequestInit][])[0][1].body as string)).toMatchObject({ action: "track", kind: "open", email: "a@b.co", name: "Maya Ross" });
    expect(await screen.findByRole("heading", { name: "Hey Maya, pick your proofs below." })).toBeTruthy();
    expect(localStorage.getItem("proof-email")).toBeNull();
  });

  it("a saved address from an older build does not skip the gate", () => {
    localStorage.setItem("proof-email", "a@b.co");
    render(<ProofGallery token="t1" initial={proof()} />);
    expect(screen.getByRole("button", { name: "Open gallery" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("proof-email")).toBeNull();
  });

  it("a sent gallery shows the walkthrough", () => {
    render(<ProofGallery token="t1" initial={proof({ submitted: true, selects: ["a"] })} />);
    expect(screen.getByRole("heading", { name: "Selects are in." })).toBeTruthy();
    expect(screen.getByRole("button", { name: /View your 1 select/ })).toBeTruthy();
  });

  it("the wall gate, the default, asks for a name as well as the email", () => {
    history.replaceState(null, "", "/");
    // reduced motion: the wall lies flat and nothing animates under jsdom
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    try {
      render(<ProofGallery token="t1" initial={proof()} />);
      fireEvent.change(screen.getByPlaceholderText("you@email.com"), { target: { value: "sam@email.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Open proofs" }));
      expect(screen.getByRole("alert").textContent).toBe("Add your name.");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
