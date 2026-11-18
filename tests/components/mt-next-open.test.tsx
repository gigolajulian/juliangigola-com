import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

/* "Next open" on the V4 Book online rows: the first day with a slot, nothing on any failure, one request per event. */
const slots = (data: Record<string, { start: string }[]>, status = "success") => ({ ok: true, json: async () => ({ status, data }) });

async function load() {
  vi.resetModules(); // the module caches one request per event
  return import("@/components/v3/mt/next-open");
}

describe("v4 next open", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("labels the earliest day that has a slot, skipping empty days", async () => {
    fetchMock.mockResolvedValue(slots({ "2026-11-21": [{ start: "2026-11-21T18:00:00Z" }], "2026-11-19": [], "2026-11-20": [{ start: "2026-11-20T17:00:00Z" }] }));
    const { useNextOpen, nextOpenLabel } = await load();
    const { result } = renderHook(() => useNextOpen("portraits"));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toBe(nextOpenLabel("2026-11-20T17:00:00Z", Intl.DateTimeFormat().resolvedOptions().timeZone));
    expect(String(fetchMock.mock.calls[0][0])).toContain("slug=portraits");
  });

  it("shows nothing when the engine fails, errors or has no slots", async () => {
    const replies = [() => Promise.reject(new Error("offline")), () => Promise.resolve({ ok: false }), () => Promise.resolve(slots({}, "error")), () => Promise.resolve(slots({ "2026-11-20": [] }))];
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
    fetchMock.mockResolvedValue(slots({ "2026-11-20": [{ start: "2026-11-20T17:00:00Z" }] }));
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
});
