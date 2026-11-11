import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProofsAstryx } from "@/components/proofs-astryx";

const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("ProofsAstryx", () => {
  it("says nothing is waiting when there are no galleries", async () => {
    const fetchMock = reply({ proofs: [] });
    vi.stubGlobal("fetch", fetchMock);
    render(<ProofsAstryx />);
    expect(await screen.findByRole("heading", { name: "Nothing waiting on clients" })).toBeTruthy();
    expect(screen.getByText(/No galleries yet/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/proof?list", expect.anything());
  });

  it("asks for a key when not signed in", async () => {
    vi.stubGlobal("fetch", reply({ error: "Not authorized." }, 401));
    render(<ProofsAstryx />);
    expect(await screen.findByLabelText("Inbox key or GitHub token")).toBeTruthy();
  });
});
