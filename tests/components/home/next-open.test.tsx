import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

/* "Next open" on the V4 Book online rows: the first day with a slot, nothing on any failure, one request per event. */
const slots = (data: Record<string, string[]> | undefined) => ({
  ok: true,
  json: async () => (data ? { slots: data } : { error: "Could not reach the calendar." }),
});

async function load() {
  vi.resetModules(); // the module caches one request per event
  return import("@/components/home/next-open");
}

describe("v4 next open", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("labels the earliest day that has a slot, skipping empty days", async () => {
    fetchMock.mockResolvedValue(
      slots({ "2026-11-21": ["2026-11-21T18:00:00Z"], "2026-11-19": [], "2026-11-20": ["2026-11-20T17:00:00Z"] }),
    );
    const { useNextOpen, nextOpenLabel } = await load();
    const { result } = renderHook(() => useNextOpen("portraits"));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toBe(nextOpenLabel("2026-11-20T17:00:00Z", Intl.DateTimeFormat().resolvedOptions().timeZone));
    expect(String(fetchMock.mock.calls[0][0])).toContain("slug=portraits");
  });

  it("shows nothing when the engine fails, errors or has no slots", async () => {
    const slot = slots({ "2026-11-20": ["2026-11-20T17:00:00Z"] }); // a real slot, so only the failure keeps the line empty
    const replies = [
      () => Promise.reject(new Error("offline")),
      () => Promise.resolve({ ...slot, ok: false }),
      () => Promise.resolve(slots(undefined)),
      () => Promise.resolve(slots({ "2026-11-20": [] })),
    ];
    for (const reply of replies) {
      fetchMock.mockImplementationOnce(reply);
      const { useNextOpen } = await load();
      const { result } = renderHook(() => useNextOpen("portraits"));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 0));
      expect(result.current).toBeNull();
      fetchMock.mockClear();
    }
  });

  it("asks once per event, however many rows read it", async () => {
    fetchMock.mockResolvedValue(slots({ "2026-11-20": ["2026-11-20T17:00:00Z"] }));
    const { useNextOpen } = await load();
    const a = renderHook(() => useNextOpen("portraits"));
    const b = renderHook(() => useNextOpen("portraits"));
    await waitFor(() => expect(a.result.current).not.toBeNull());
    await waitFor(() => expect(b.result.current).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no session, no request", async () => {
    const { useNextOpen } = await load();
    const { result } = renderHook(() => useNextOpen(null));
    expect(result.current).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("writes the day short, with no comma", async () => {
    const { nextOpenLabel } = await load();
    expect(nextOpenLabel("2026-11-20T17:00:00Z", "America/Los_Angeles")).toBe("Fri Nov 20");
  });

  it("asks from today in Pacific time, so an evening still finds today's times", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T01:30:00Z")); // 5:30 PM Pacific on Nov 23, already Nov 24 in UTC
    try {
      const { slotWindow } = await load();
      expect(slotWindow("America/Los_Angeles")).toEqual({ start: "2026-11-23", end: "2027-01-22" });
      expect(slotWindow("Asia/Tokyo").start).toBe("2026-11-23"); // a zone ahead still starts at Julian's today
      // 1:30 AM Pacific on Nov 24 is still Nov 23 in Honolulu: the visitor's earlier day wins
      expect(slotWindow("Pacific/Honolulu", new Date("2026-11-24T09:30:00Z")).start).toBe("2026-11-23");
      fetchMock.mockResolvedValue(slots({}));
      const { useNextOpen } = await load();
      renderHook(() => useNextOpen("portraits"));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const q = new URL(String(fetchMock.mock.calls[0][0]), "http://x").searchParams;
      expect(q.get("start")! <= "2026-11-23").toBe(true); // never the UTC day
    } finally {
      vi.useRealTimers();
    }
  });
});
