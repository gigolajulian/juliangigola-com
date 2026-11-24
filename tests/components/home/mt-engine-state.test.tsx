import { afterEach, expect, test, vi } from "vitest";
import { startEngine } from "@/components/home/motion/engine";
import { barDrivers } from "@/components/home/motion/bars";

/* A driver's state lives in its setup closure, one per section: two sections
   with one driver name never share it (engine.ts Driver.setup). */

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

test("two sections with one driver name keep separate state", () => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  const root = document.createElement("div");
  root.innerHTML = '<section data-mt="book"></section><section data-mt="book"></section>';
  document.body.append(root);
  const stop = startEngine(root, barDrivers);
  vi.advanceTimersToNextFrame();
  vi.advanceTimersToNextFrame();
  // jsdom boxes are all zero: both tops sit above 0.45 of the screen, so both take the bar
  const secs = [...root.querySelectorAll("section")];
  expect(secs.map((s) => s.hasAttribute("data-bar"))).toEqual([true, true]);
  stop();
  expect(secs.map((s) => s.hasAttribute("data-bar"))).toEqual([false, false]);
});
