import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const lenis = vi.hoisted(() => ({ made: 0, destroyed: 0, to: [] as number[] }));
vi.mock("lenis", () => ({
  default: class {
    animatedScroll = 0;
    targetScroll = 0;
    constructor() {
      lenis.made++;
    }
    on() {}
    resize() {}
    scrollTo(y: number) {
      lenis.to.push(y);
    }
    destroy() {
      lenis.destroyed++;
    }
  },
}));

import { SmoothScroll, onLenisScroll, scrollTop, shiftScroll } from "@/components/v3/smooth-scroll";

describe("smooth-scroll", () => {
  it("scrollTop and shiftScroll fall back to the window without Lenis", () => {
    const to = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    window.scrollBy = vi.fn();
    scrollTop();
    expect(to).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
    shiftScroll(40);
    expect(window.scrollBy).toHaveBeenCalledWith(0, 40);
  });

  it("onLenisScroll returns an unsubscribe", () => {
    const off = onLenisScroll(() => {});
    expect(typeof off).toBe("function");
    off();
  });

  it("SmoothScroll starts Lenis, routes scrollTop through it, and destroys it", () => {
    const { container, unmount } = render(<SmoothScroll />);
    expect(container.innerHTML).toBe("");
    expect(lenis.made).toBe(1);
    scrollTop();
    expect(lenis.to).toEqual([0]);
    unmount();
    expect(lenis.destroyed).toBe(1);
  });
});
