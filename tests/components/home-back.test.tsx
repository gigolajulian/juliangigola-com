import { afterEach, describe, expect, it } from "vitest";
import { dropSpot, keepSpot, spotHere } from "@/components/v4/home/back";

/* The home keeps its own spot for Back from any page (components/v4/home/back.ts): the block under the screen's top and
   how far into it, so a held block above that takes its height late cannot throw the page off. */

const block = (name: string, top: number) => {
  const el = document.createElement("section");
  el.dataset.mt = name;
  Object.defineProperty(el, "offsetTop", { value: top });
  document.body.append(el);
};

afterEach(() => {
  document.body.innerHTML = "";
  sessionStorage.clear();
  history.scrollRestoration = "auto";
  window.scrollY = 0;
});

describe("home Back spot", () => {
  it("names the block under the screen's top and the distance into it", () => {
    block("hero", 0);
    block("covers", 2000);
    block("about", 5000);
    window.scrollY = 2600;
    expect(spotHere()).toEqual({ b: "covers", off: 600, x: 0 }); // no covers row here: x stays 0
  });

  it("keeps the spot with the browser's own restore off, and drops it again", () => {
    keepSpot({ b: "about", off: 40, x: 0 });
    expect(JSON.parse(sessionStorage.getItem("jg-home-back")!)).toEqual({ b: "about", off: 40, x: 0 });
    expect(history.scrollRestoration).toBe("manual");
    dropSpot();
    expect(sessionStorage.getItem("jg-home-back")).toBeNull();
    expect(history.scrollRestoration).toBe("auto");
  });
});
