import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Relative import: the coverage scanner resolves `@/` under src/, which this repo does not have.
import { burst } from "../../../components/splash/burst-splash";

/* The name splash on every page but the homepage: it builds the wordmark
   and loader in the sheet, runs only when asked, and hands the page over
   once the letters are up and the page has loaded. */

const root = document.documentElement;
let animated: Element[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  animated = [];
  Element.prototype.animate = function (this: Element) {
    animated.push(this);
    return {} as Animation;
  };
  document.body.innerHTML = `<div id="jg-intro"><div class="jg-sheet-wrap"><div class="jg-sheet-ground"></div></div></div>`;
  root.dataset.splash = "name";
  root.dataset.intro = "1";
});
afterEach(() => {
  vi.useRealTimers();
  for (const k of ["splash", "intro", "splashed"]) delete root.dataset[k];
});

describe("burst", () => {
  it("does nothing on the homepage's splash, once the intro is past, or without the sheet", () => {
    root.dataset.splash = "split";
    burst();
    root.dataset.splash = "name";
    root.dataset.intro = "half";
    burst();
    root.dataset.intro = "1";
    document.body.innerHTML = "";
    burst();
    expect(document.querySelector(".jg-burst-word")).toBeNull();
    expect(animated).toEqual([]);
  });

  it("writes Julian Gigola as two lines of single letters, labelled once, with the loader", () => {
    burst();
    const word = document.querySelector(".jg-burst-word")!;
    expect(word.getAttribute("aria-label")).toBe("Julian Gigola");
    expect([...word.querySelectorAll(".jg-burst-line")].map((l) => l.textContent)).toEqual(["Julian", "Gigola"]);
    expect(word.querySelectorAll(".jg-burst-line > span")).toHaveLength(12);
    expect(document.querySelector(".jg-sheet-wrap > .jg-burst-bar > i")).not.toBeNull();
  });

  it("hands the page over: intro half, then cleared, with the sheet opened", async () => {
    burst();
    // Every letter rises, and the loader fades in.
    expect(animated.filter((e) => e.parentElement?.classList.contains("jg-burst-line"))).toHaveLength(12);
    expect(root.dataset.intro).toBe("1");
    await vi.advanceTimersByTimeAsync(750);
    expect(root.dataset.intro).toBe("half");
    expect(root.dataset.splashed).toBe("");
    expect(document.getElementById("jg-intro")!.classList.contains("jg-intro-open")).toBe(true);
    await vi.advanceTimersByTimeAsync(250);
    expect(root.hasAttribute("data-intro")).toBe(false);
  });
});
