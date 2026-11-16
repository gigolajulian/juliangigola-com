import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { burst } from "@/components/splash/burst-splash";
import { split } from "@/components/splash/split-splash";
import { byCodeUnit } from "@/lib/utils";

/* The splash's frames come from the resizer. One it refuses (a blocker, or
   on a branch preview a photograph only the branch has) is asked for again
   as the plain file, and only then counted as there. */
const LIVE = "https://juliangigola.com/cdn-cgi/image/width=640,quality=85,format=auto";
const frames = [[`${LIVE}/work/nyx/a-w1080.jpg`, `${LIVE}/work/nyx/a-w1080.jpg`], ["/cdn-cgi/image/width=640/work/nyx/b-w1080.jpg", "/cdn-cgi/image/width=640/work/nyx/b-w1080.jpg"]];
const heroes = { d: [[640, `${LIVE}/work/nyx/hero.jpg`] as [number, string]], l: [[640, `${LIVE}/work/nyx/hero.jpg`] as [number, string]] };

describe.each([["burst", burst], ["split", split]] as const)("%s splash", (name, play) => {
  let decodes = 0;
  beforeEach(() => {
    vi.useFakeTimers(); // the opening itself stays parked at its first wait
    document.documentElement.dataset.splash = name;
    document.documentElement.dataset.intro = "1";
    document.body.innerHTML = '<div id="jg-intro"><div class="jg-sheet-wrap"></div></div>';
    decodes = 0;
    HTMLImageElement.prototype.decode = function () {
      decodes++;
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
    expect(got.map((g) => String(g[1])).sort(byCodeUnit)).toEqual(["/work/nyx/a-w1080.jpg", "/work/nyx/b-w1080.jpg", "/work/nyx/hero.jpg"]);
    // the plain file is decoded only once it has loaded (Firefox refuses a decode() in the same turn as the new src)
    expect(decodes).toBe(3);
    for (const i of document.querySelectorAll("#jg-intro img")) i.dispatchEvent(new Event("load"));
    await vi.advanceTimersByTimeAsync(0);
    expect(decodes).toBe(6);
  });
});
