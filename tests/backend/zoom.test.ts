import { afterEach, describe, expect, it, vi } from "vitest";
import { lockScroll, pushHistory } from "@/lib/zoom";

/* Around the viewer: the page holds still under it and comes back where
   it was; the back button closes it instead of leaving the page. The
   window is a stand-in with just the parts these touch. */

afterEach(() => vi.unstubAllGlobals());

describe("lockScroll", () => {
  it("stops the page and puts it back exactly", () => {
    const root = { style: { overflow: "auto" } };
    const scrollTo = vi.fn();
    vi.stubGlobal("window", { scrollX: 3, scrollY: 420, scrollTo });
    vi.stubGlobal("document", { documentElement: root });
    const unlock = lockScroll();
    expect(root.style.overflow).toBe("hidden");
    unlock();
    expect(root.style.overflow).toBe("auto");
    expect(scrollTo).toHaveBeenCalledWith(3, 420);
  });
});

describe("pushHistory", () => {
  const fakeWindow = () => {
    const listeners = new Set<() => void>();
    const history = {
      state: { router: 1 } as Record<string, unknown> | null,
      scrollRestoration: "auto",
      pushState: vi.fn((s: Record<string, unknown>) => (history.state = s)),
      back: vi.fn(),
    };
    const w = {
      history,
      addEventListener: (_: string, f: () => void) => listeners.add(f),
      removeEventListener: (_: string, f: () => void) => listeners.delete(f),
      pop: () => [...listeners].forEach((f) => f()),
      listeners,
    };
    vi.stubGlobal("window", w);
    return w;
  };

  it("closes on back, once, and gives the scroll back to the browser", () => {
    const w = fakeWindow();
    const onBack = vi.fn();
    const done = pushHistory(onBack);
    expect(w.history.state).toMatchObject({ router: 1, zoom: expect.stringMatching(/^zoom:/) });
    expect(w.history.scrollRestoration).toBe("manual");
    w.pop();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(w.history.scrollRestoration).toBe("auto");
    expect(w.listeners.size).toBe(0);
    done();
    expect(w.history.back).not.toHaveBeenCalled();
  });

  it("takes its own entry off when closed another way", () => {
    const w = fakeWindow();
    const onBack = vi.fn();
    const done = pushHistory(onBack);
    done();
    expect(w.history.back).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    done();
    expect(w.history.back).toHaveBeenCalledTimes(1);
  });
});
