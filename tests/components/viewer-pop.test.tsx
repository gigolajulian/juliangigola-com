import { afterEach, describe, expect, it, vi } from "vitest";
import { pushHistory, viewerPop } from "@/lib/zoom";

afterEach(() => vi.useRealTimers());

describe("viewerPop", () => {
  it("counts the viewer's entry until its pop has gone round every listener", () => {
    vi.useFakeTimers();
    expect(viewerPop()).toBe(false);
    const onBack = vi.fn();
    pushHistory(onBack);
    expect(viewerPop()).toBe(true);
    // The back button: listeners heard in the same dispatch still see the viewer.
    let seen: boolean | null = null;
    window.addEventListener("popstate", () => (seen = viewerPop()), { once: true });
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onBack).toHaveBeenCalledOnce();
    expect(seen).toBe(true);
    vi.runAllTimers();
    expect(viewerPop()).toBe(false);
  });

  it("drops the count at once when the viewer closes off its own entry", () => {
    const unpush = pushHistory(() => {});
    window.history.replaceState({}, ""); // the entry is no longer on top
    unpush();
    expect(viewerPop()).toBe(false);
  });
});
