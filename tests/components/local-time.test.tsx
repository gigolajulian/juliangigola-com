import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLocalTime } from "@/lib/local-time";

/* Julian's local time in the footers. */

afterEach(() => {
  vi.useRealTimers();
});

describe("useLocalTime", () => {
  it("shows the Pacific time to the minute and keeps it current", () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-20T18:05:00Z") });
    const { result } = renderHook(() => useLocalTime());
    expect(result.current).toBe("10:05 AM PST");
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe("10:06 AM PST");
  });
});
