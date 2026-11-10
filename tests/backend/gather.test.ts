import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { builds, FLY, gather, slides, streams } from "@/lib/gather";

/* Where each frame flies in from, and the flight home handed to GSAP.
   The window and the elements are plain stand-ins. */

const rect = (left: number, top: number, w = 100, h = 100) => ({ left, top, width: w, height: h, right: left + w, bottom: top + h }) as DOMRect;
const el = (col?: number, order = 0) => {
  const style: Record<string, string> = {};
  return {
    order,
    style: Object.assign(style, { removeProperty: (k: string) => delete style[k] }),
    closest: () => (col === undefined ? null : { dataset: { col: String(col) } }),
    getBoundingClientRect: () => rect(order * 100, 0),
  } as unknown as HTMLElement & { order: number };
};

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1000);
  vi.stubGlobal("innerHeight", 800);
});
afterEach(() => vi.unstubAllGlobals());

describe("paths", () => {
  it("streams every other column the other way", () => {
    expect(streams(el(0), rect(0, 0), 0)).toEqual({ x: 0, y: -900, delay: 0 });
    expect(streams(el(1), rect(0, 0), 0)).toMatchObject({ y: 900, delay: 0.05 });
  });
  it("builds row by row from the bottom, left to right", () => {
    const bottomLeft = builds(el(), rect(0, 700), 0);
    const bottomNext = builds(el(), rect(100, 700), 0);
    const above = builds(el(), rect(0, 600), 0);
    expect(bottomLeft.delay).toBe(0);
    expect(bottomNext.delay).toBeCloseTo(0.09);
    expect(above.delay).toBeCloseTo(0.32);
    expect(bottomLeft.y).toBeCloseTo(35);
  });
  it("slides in from past the right edge, in order", () => {
    expect(slides(el(), rect(200, 0), 3)).toEqual({ x: 840, y: 0, delay: 0.24 });
  });
});

describe("gather", () => {
  it("parks each frame hidden, then flies it home by its order", () => {
    vi.stubGlobal("getComputedStyle", (f: HTMLElement & { order: number }) => ({ getPropertyValue: () => String(f.order) }));
    const gsap = { set: vi.fn(), to: vi.fn() };
    const frames = [el(undefined, 2), el(undefined, 1)];
    const go = gather(frames, slides, gsap as never);
    expect(gsap.set).toHaveBeenCalledWith(frames[0], { x: 1000 - 200 + 40, y: 0, visibility: "hidden" });
    expect(gsap.to).not.toHaveBeenCalled();
    go();
    const [[first, a], [second, b]] = gsap.to.mock.calls;
    expect(first).toBe(frames[0]);
    expect(a).toMatchObject({ x: 0, y: 0, duration: FLY, delay: 0.05 + 0.08 });
    expect(second).toBe(frames[1]);
    expect(b.delay).toBeCloseTo(0.05);
    a.onStart();
    a.onComplete();
    expect(frames[0].style.transform).toBeUndefined();
  });
});
