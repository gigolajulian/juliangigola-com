import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { dropSpot, keepSpot, spotHere, useBackHome } from "@/components/home/back";
import { painted } from "@/lib/painted";

/* The home keeps its own spot for Back from any page (components/home/back.ts): the block under the screen's top and
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

  it("Back into Cover art loads the restored cover's art and its neighbours' now, with the viewer's copy under it until it decodes", async () => {
    block("covers", 0);
    const sec = document.querySelector<HTMLElement>("[data-mt=covers]")!;
    sec.className = "mt-covers";
    const row = document.createElement("div");
    row.className = "mt-row";
    sec.append(row);
    const ims = [0, 1, 2, 3, 4].map((i) => {
      const it = document.createElement("a");
      it.className = "mt-item";
      Object.defineProperty(it, "offsetLeft", { value: i * 300 });
      it.innerHTML = `<div class="face"><img data-frame="/c/${i}.jpg" loading="lazy"><img class="back" loading="lazy"></div>`;
      row.append(it);
      const im = it.querySelector<HTMLImageElement>("img:not(.back)")!;
      im.decode = () => Promise.resolve();
      return im;
    });
    painted.set("/c/3.jpg", "/seen-3.jpg");
    const told: unknown[] = [];
    sec.addEventListener("mt-tell", (e) => told.push((e as CustomEvent).detail));
    keepSpot({ b: "covers", off: 0, x: 900 });
    dispatchEvent(new PopStateEvent("popstate"));
    renderHook(() => useBackHome());
    expect(ims.map((im) => im.loading ?? im.getAttribute("loading"))).toEqual(["lazy", "lazy", "eager", "eager", "eager"]); // cover 4 of 5 and the two beside it
    expect(sec.querySelectorAll("img.back[loading=eager]").length).toBe(0);
    expect(told).toEqual([{ cur: 3, now: false }]); // the caption names cover 4 before the first paint
    const face = ims[3].parentElement!;
    expect(face.style.backgroundImage).toContain("/seen-3.jpg");
    expect(face.style.backgroundColor).toBe(""); // the card colour stays the stylesheet's
    await new Promise((r) => setTimeout(r)); // decode resolved: the sleeve's own copy is on top, the under-copy goes
    expect(face.style.backgroundImage).toBe("");
  });
});
