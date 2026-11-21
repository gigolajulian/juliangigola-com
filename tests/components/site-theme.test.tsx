import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSiteTheme, useSiteThemeRead } from "@/lib/site-theme";

/* The site's own light or dark, read off `data-theme` and followed. */

afterEach(() => {
  delete document.documentElement.dataset.theme;
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
