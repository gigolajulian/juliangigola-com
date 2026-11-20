import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSiteTheme, useSiteThemeRead } from "@/lib/site-theme";
import { useLocalTime } from "@/lib/local-time";

/* Two small hooks the pages share: the site's own light or dark, read off
   `data-theme` and followed, and Julian's local time in the footers. */

afterEach(() => {
  delete document.documentElement.dataset.theme;
  vi.useRealTimers();
});

describe("useSiteTheme", () => {
  it("reads data-theme and follows it when it flips", async () => {
    document.documentElement.dataset.theme = "light";
    const { result } = renderHook(() => useSiteTheme());
    expect(result.current).toBe("light");
    act(() => void (document.documentElement.dataset.theme = "dark"));
    await waitFor(() => expect(result.current).toBe("dark"));
  });

  it("reads anything but light as dark", () => {
    document.documentElement.dataset.theme = "sepia";
    expect(renderHook(() => useSiteThemeRead()).result.current).toBe("dark");
  });
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
