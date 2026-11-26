import { describe, expect, it } from "vitest";
import { isTrackpad, notchStream } from "@/lib/motion/wheel";

const px = (deltaX: number, deltaY: number) => ({ deltaMode: 0, deltaX, deltaY });

describe("isTrackpad", () => {
  it("reads small pixel deltas as a trackpad", () => {
    expect(isTrackpad(px(0, 4), 2)).toBe(true);
    expect(isTrackpad(px(-12, 3), 2)).toBe(true);
  });

  it("reads a notch as a wheel", () => {
    // A Mac mouse notch is 100px at any density.
    expect(isTrackpad(px(0, 100), 1)).toBe(false);
    expect(isTrackpad(px(0, -100), 2)).toBe(false);
  });

  it("measures in device pixels, so density matters", () => {
    // 50 CSS px is a trackpad at 1x and a notch at 2x.
    expect(isTrackpad(px(0, 50), 1)).toBe(true);
    expect(isTrackpad(px(0, 50), 2)).toBe(false);
  });

  it("puts the line at 80 device pixels, exclusive", () => {
    expect(isTrackpad(px(0, 39.9), 2)).toBe(true);
    expect(isTrackpad(px(0, 40), 2)).toBe(false);
  });

  it("uses the larger of the two axes", () => {
    expect(isTrackpad(px(90, 1), 1)).toBe(false);
  });

  it("treats a missing density as 1", () => {
    expect(isTrackpad(px(0, 60), 0)).toBe(true);
  });

  it("reads line and page modes as a wheel, however small", () => {
    expect(isTrackpad({ deltaMode: 1, deltaX: 0, deltaY: 1 }, 1)).toBe(false);
    expect(isTrackpad({ deltaMode: 2, deltaX: 0, deltaY: 1 }, 1)).toBe(false);
  });
});

describe("notchStream", () => {
  const ev = (deltaY: number, timeStamp: number, deltaMode = 0) => ({ deltaMode, deltaX: 0, deltaY, timeStamp });

  it("keeps a trackpad flick a trackpad when it peaks past a notch", () => {
    const isNotch = notchStream();
    const flick = [2, 6, 14, 30, 55, 90, 140, 90, 40, 12, 3];
    expect(flick.map((d, i) => isNotch(ev(d, i * 16), 2))).toEqual(flick.map(() => false));
  });

  it("reads a mouse spin as notches, and each slow notch on its own", () => {
    const isNotch = notchStream();
    expect([0, 40, 80].map((t) => isNotch(ev(100, t), 1.5))).toEqual([true, true, true]);
    expect(isNotch(ev(100, 1000), 1.5)).toBe(true);
    expect(isNotch(ev(1, 2000, 1), 1)).toBe(true);
  });

  it("starts a new read after a gap", () => {
    const isNotch = notchStream();
    isNotch(ev(100, 0), 1);
    expect(isNotch(ev(4, 500), 1)).toBe(false);
    expect(isNotch(ev(120, 510), 1)).toBe(false);
  });
});
