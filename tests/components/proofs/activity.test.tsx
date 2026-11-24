import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActivityDesk } from "@/components/proofs/activity";
import type { ProofRow } from "@/lib/proofs/proof-desk";
import type { Viewer } from "@/lib/proofs/proof-model";

/* `components/proofs/activity.tsx`: who opened a gallery, what they did,
   and Forget for Julian's own test visits. */

const viewer = (over: Partial<Viewer> = {}): Viewer => ({
  first: "2026-11-18T20:00:00Z",
  last: "2026-11-18T21:00:00Z",
  visits: 1,
  seconds: 45,
  devices: ["iPhone"],
  places: ["San Jose"],
  picks: [],
  looks: {},
  events: [],
  ...over,
});

const row = (over: Partial<ProofRow> = {}) =>
  ({
    token: "t1",
    name: "Studio day",
    frames: [{ id: "a", file: "A.jpg" }, { id: "b", file: "B.jpg" }],
    viewers: {},
    url: "/proof/t1",
    ...over,
  }) as unknown as ProofRow;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ActivityDesk", () => {
  it("says nobody has opened it yet", () => {
    render(<ActivityDesk p={row()} changed={() => {}} />);
    expect(screen.getByText(/Nobody has opened it yet/)).toBeTruthy();
  });

  it("shows the latest viewer's facts, most picked frames and event log", () => {
    const p = row({
      viewers: {
        "old@b.co": viewer({ last: "2026-11-17T20:00:00Z", picks: ["b"] }),
        "maya@b.co": viewer({
          name: "Maya",
          visits: 3,
          seconds: 300,
          picks: ["b", "a"],
          looks: { b: 12_000 },
          events: [
            { at: "2026-11-18T20:00:00Z", kind: "open", device: "iPhone", place: "San Jose" },
            { at: "2026-11-18T20:01:00Z", kind: "pick", id: "b" },
            { at: "2026-11-18T20:02:00Z", kind: "unpick", id: "a" },
          ],
        }),
      },
    });
    render(<ActivityDesk p={p} changed={() => {}} />);
    expect(screen.getByText("5 min")).toBeTruthy();
    expect(screen.getByText("1 unpicked")).toBeTruthy();
    expect(screen.getByText("#2 · 12 s")).toBeTruthy();
    // Frame b picked by both viewers: first in Most picked, with a count of 2.
    expect(screen.getAllByRole("img").map((i) => i.getAttribute("alt"))).toEqual(["#2", "#1"]);
    expect(screen.getByText(/picked #2 · B\.jpg/)).toBeTruthy();
    expect(screen.getByText(/opened · iPhone · San Jose/)).toBeTruthy();
  });

  it("Forget asks first, then forgets that address and refreshes the desk", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const changed = vi.fn();
    render(<ActivityDesk p={row({ viewers: { "maya@b.co": viewer() } })} changed={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "Forget" }));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(confirm.mock.calls[0][0]).toMatch(/Forget maya@b\.co's visits to "Studio day"/);
    const [url, init] = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0];
    expect(url).toBe("/api/proof");
    expect(JSON.parse(init.body as string)).toEqual({ action: "forget", token: "t1", email: "maya@b.co" });
    expect(await screen.findByText("maya@b.co forgotten.")).toBeTruthy();
  });

  it("Forget does nothing when he says no", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ActivityDesk p={row({ viewers: { "maya@b.co": viewer() } })} changed={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Forget" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
