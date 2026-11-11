import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

vi.mock("dialkit", () => ({
  useDialKit: (_: string, spec: Record<string, number[]>) =>
    Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, v[0]])),
}));
vi.mock("@/components/drift-wall", () => ({
  default: ({ items, tileWidth }: { items: unknown[]; tileWidth: number }) => <div data-testid="wall" data-n={items.length} data-w={tileWidth} />,
}));

import { InquireWall } from "@/components/inquire-wall";

const items = [{ src: "/work/nyx/01.jpg", title: "Nyx", href: "/portfolio/nyx" }];

describe("InquireWall", () => {
  it("waits with a placeholder until it comes near", () => {
    const { container } = render(<InquireWall items={items} />);
    expect(screen.queryByTestId("wall")).toBeNull();
    expect(container.firstElementChild?.className).toBe("h-full w-full");
  });

  it("builds the wall once in view and still", () => {
    vi.useFakeTimers();
    const Real = globalThis.IntersectionObserver;
    // An observer that reports in view at once.
    globalThis.IntersectionObserver = class {
      cb: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) {
        this.cb = cb;
      }
      observe() {
        this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
    try {
      render(<InquireWall items={items} />);
      act(() => vi.advanceTimersByTime(250));
      const wall = screen.getByTestId("wall");
      expect(wall.getAttribute("data-n")).toBe("1");
      expect(wall.getAttribute("data-w")).toBe(String(Math.round(300 * 0.85)));
    } finally {
      globalThis.IntersectionObserver = Real;
      vi.useRealTimers();
    }
  });
});
