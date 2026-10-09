import { describe, expect, it } from "vitest";
import {
  MAX_FRAME,
  OMEGA,
  RESPONSE,
  type SpringState,
  frameDt,
  launchSpeed,
  springSettled,
  stepSpring,
} from "./spring";

/** Runs the spring at 60Hz until it settles and reports how far it went
    past the target and how long it took. */
function settle(v: number, target: number, zeta: number) {
  let s: SpringState = { x: 0, v };
  let over = 0;
  let ms = 0;
  while (!springSettled(s, target) && ms < 5000) {
    s = stepSpring(s, target, zeta, 1 / 60);
    ms += 1000 / 60;
    over = Math.max(over, Math.sign(target) * (s.x - target));
  }
  return { over, ms, s };
}

describe("frameDt", () => {
  it("takes a 60Hz frame first", () => {
    expect(frameDt(1000, 0)).toBeCloseTo(1 / 60, 9);
  });

  it("takes the real gap after that, in seconds", () => {
    expect(frameDt(1016, 1000)).toBeCloseTo(0.016, 9);
  });

  it("caps a long frame at 64ms", () => {
    expect(frameDt(1300, 1000)).toBe(MAX_FRAME);
    expect(MAX_FRAME).toBe(0.064);
  });
});

describe("stepSpring", () => {
  it("rings at the response period", () => {
    expect(RESPONSE).toBe(0.42);
    expect(OMEGA).toBeCloseTo((2 * Math.PI) / 0.42, 9);
  });

  it("does nothing at rest on the target", () => {
    expect(stepSpring({ x: 768, v: 0 }, 768, 1, 1 / 60)).toEqual({ x: 768, v: 0 });
  });

  it("steps in 4ms pieces: one 16ms frame is four 4ms frames", () => {
    let a: SpringState = { x: 0, v: 0 };
    for (let i = 0; i < 4; i++) a = stepSpring(a, 500, 1, 0.004);
    const b = stepSpring({ x: 0, v: 0 }, 500, 1, 0.016);
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.v).toBeCloseTo(a.v, 9);
  });

  it("steps a frame that is not a whole number of pieces", () => {
    // 10ms is 4 + 4 + 2.
    let a: SpringState = { x: 0, v: 0 };
    for (const h of [0.004, 0.004, 0.002]) a = stepSpring(a, 500, 1, h);
    const b = stepSpring({ x: 0, v: 0 }, 500, 1, 0.01);
    expect(b.x).toBeCloseTo(a.x, 9);
  });

  it("brings a strip at rest to its screen without passing it, critically damped", () => {
    const { over, s } = settle(0, 768, 1);
    expect(over).toBeLessThanOrEqual(0);
    expect(springSettled(s, 768)).toBe(true);
  });

  it("swings past a little underdamped, on a flick", () => {
    // Released from rest 768px short with zeta 0.8: a small overshoot.
    const { over } = settle(0, 768, 0.8);
    expect(over).toBeGreaterThan(0);
    expect(over).toBeLessThan(768 * 0.02);
  });
});

describe("springSettled", () => {
  it("needs both under half a pixel and under 20px per second", () => {
    expect(springSettled({ x: 100.4, v: 19 }, 100)).toBe(true);
    expect(springSettled({ x: 100.5, v: 0 }, 100)).toBe(false);
    expect(springSettled({ x: 100, v: 20 }, 100)).toBe(false);
    expect(springSettled({ x: 99.6, v: -19 }, 100)).toBe(true);
  });
});

describe("launchSpeed", () => {
  it("passes a speed under the cap straight through, in px per second", () => {
    // 768px to go allows 2PI/0.42 * 768, about 11489px/s.
    expect(launchSpeed(2, 768, 1)).toBe(2000);
    expect(launchSpeed(-2, -768, 1)).toBe(-2000);
  });

  it("caps at what a critically damped spring can stop in the distance", () => {
    expect(launchSpeed(14, 180, 1)).toBeCloseTo(OMEGA * 180, 9);
    expect(launchSpeed(-14, -180, 1)).toBeCloseTo(-OMEGA * 180, 9);
  });

  it("allows a flick a quarter more", () => {
    expect(launchSpeed(14, 180, 0.8)).toBeCloseTo(OMEGA * 180 * 1.25, 9);
  });

  it("does not cap a strip heading away from its screen", () => {
    // A reversed throw: the strip moves forward, the screen is behind it.
    expect(launchSpeed(3, -200, 1)).toBe(3000);
    expect(launchSpeed(-3, 200, 0.8)).toBe(-3000);
  });

  it("launches nothing with no speed", () => {
    expect(launchSpeed(0, 300, 1)).toBe(0);
    expect(launchSpeed(0, 0, 1)).toBe(0);
  });

  it("stops a hard flick that used to overshoot by 236px", () => {
    /* Measured in WebKit at iPad size: let go 180px short of a screen at
       14px/ms, it ran 236px into the next one before coming back. Here,
       uncapped, the same throw runs past by more than 200px. */
    const uncapped = settle(14 * 1000, 180, 0.8);
    expect(uncapped.over).toBeGreaterThan(200);
    // Capped, a flick's give is a few pixels and it settles sooner.
    const capped = settle(launchSpeed(14, 180, 0.8), 180, 0.8);
    expect(capped.over).toBeLessThan(180 * 0.1);
    expect(capped.ms).toBeLessThan(uncapped.ms);
  });

  it("does not overshoot at all from the cap when critically damped", () => {
    const { over } = settle(launchSpeed(14, 180, 1), 180, 1);
    expect(over).toBeLessThanOrEqual(0);
  });
});
