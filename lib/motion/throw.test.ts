import { describe, expect, it } from "vitest";
import { DECEL, FLICK, dampingFor, projectThrow } from "./throw";

describe("projectThrow", () => {
  it("runs a throw out at iOS's deceleration", () => {
    // 0.998 per ms keeps going for 499ms worth of the speed.
    expect(DECEL / (1 - DECEL)).toBeCloseTo(499, 6);
    expect(projectThrow(0, 1)).toBeCloseTo(499, 6);
    expect(projectThrow(1000, 2)).toBeCloseTo(1998, 6);
  });

  it("stays put with no speed", () => {
    expect(projectThrow(768, 0)).toBe(768);
  });

  it("projects a reversed throw backwards", () => {
    expect(projectThrow(1536, -1.5)).toBeCloseTo(1536 - 748.5, 6);
  });
});

describe("dampingFor", () => {
  it("is critically damped for a slow lift", () => {
    expect(dampingFor(0.1)).toBe(1);
    expect(dampingFor(-0.2)).toBe(1);
  });

  it("gives a flick a little give, either way", () => {
    expect(dampingFor(1.4)).toBe(0.8);
    expect(dampingFor(-1.4)).toBe(0.8);
  });

  it("needs more than the threshold, not just the threshold", () => {
    expect(dampingFor(FLICK)).toBe(1);
    expect(dampingFor(FLICK + 0.001)).toBe(0.8);
  });
});
