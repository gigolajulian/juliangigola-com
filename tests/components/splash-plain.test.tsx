import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { burst } from "@/components/splash/burst-splash";
import { split } from "@/components/splash/split-splash";

/* The splash's frames come from the resizer. One it refuses (a blocker, or
   on a branch preview a photograph only the branch has) is asked for again
   as the plain file, and only then counted as there. */
const LIVE = "https://juliangigola.com/cdn-cgi/image/width=640,quality=85,format=auto";
const frames = [[`${LIVE}/work/nyx/a-w1080.jpg`, `${LIVE}/work/nyx/a-w1080.jpg`], ["/cdn-cgi/image/width=640/work/nyx/b-w1080.jpg", "/cdn-cgi/image/width=640/work/nyx/b-w1080.jpg"]];
const heroes = { d: [[640, `${LIVE}/work/nyx/hero.jpg`] as [number, string]], l: [[640, `${LIVE}/work/nyx/hero.jpg`] as [number, string]] };

describe.each([["burst", burst], ["split", split]] as const)("%s splash", (name, play) => {
  beforeEach(() => {
    vi.useFakeTimers(); // the opening itself stays parked at its first wait
    document.documentElement.dataset.splash = name;
    document.documentElement.dataset.intro = "1";
    document.body.innerHTML = '<div id="jg-intro"><div class="jg-sheet-wrap"></div></div>';
    HTMLImageElement.prototype.decode = function () {
      return this.src.includes("/cdn-cgi/") ? Promise.reject(new Error("refused")) : Promise.resolve();
    };
    Element.prototype.animate = (() => ({})) as unknown as Element["animate"];
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("asks for a refused frame again as its plain file, once", async () => {
    play(frames, heroes);
    await vi.advanceTimersByTimeAsync(0);
    const got = [...document.querySelectorAll<HTMLImageElement>("#jg-intro img")].map((i) => [new URL(i.src).origin, new URL(i.src).pathname, i.dataset.plain]);
    expect(got).toHaveLength(3);
    for (const [origin, , plain] of got) expect([origin, plain]).toEqual([location.origin, ""]);
    expect(got.map((g) => g[1]).sort()).toEqual(["/work/nyx/a-w1080.jpg", "/work/nyx/b-w1080.jpg", "/work/nyx/hero.jpg"]);
  });
});
