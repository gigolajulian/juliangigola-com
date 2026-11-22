import { describe, expect, it, vi } from "vitest";
import { arrived } from "@/components/v4/home/motion/reveal";

const entry = (el: HTMLElement, isIntersecting: boolean, top: number) =>
  ({ target: el, isIntersecting, boundingClientRect: { top } }) as unknown as IntersectionObserverEntry;

describe("home reveal", () => {
  it("is visible until the observer has seen a block below the fold, then reveals it", () => {
    const io = { unobserve: vi.fn() } as unknown as IntersectionObserver;
    const below = document.createElement("div"), near = document.createElement("div");
    expect(below.dataset.rv).toBeUndefined(); // nothing hidden before a callback
    arrived([entry(below, false, innerHeight + 200), entry(near, false, innerHeight - 10)], io);
    expect(below.dataset.rv).toBe("");
    expect(near.dataset.rv).toBe("in");
    arrived([entry(below, true, 100)], io);
    expect(below.dataset.rv).toBe("in");
  });
});
