import type { BrowserContext, Page, TestInfo } from "@playwright/test";

/* Declared for the scripts the suite puts into a page. */
declare global {
  interface Window {
    __perfFrames: number[];
    __perfOn: boolean;
  }
}

/** The splash runs once a visit. Marked as seen, a page opens straight away. */
export async function skipSplash(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("jg-intro", "1");
    } catch {}
  });
}

/**
 * Records every frame's length while `window.__perfOn` is true. Put in
 * before the page's own scripts, so its frame loop is the first one.
 */
export async function recordFrames(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    const f: number[] = (window.__perfFrames = []);
    window.__perfOn = false;
    let last = 0;
    const tick = (t: number) => {
      if (last && window.__perfOn) f.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function framesOn(page: Page) {
  await page.evaluate(() => {
    window.__perfFrames.length = 0;
    window.__perfOn = true;
  });
}

export async function framesOff(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    window.__perfOn = false;
    return window.__perfFrames.slice();
  });
}

/**
 * The page's idle frame length, median of 20 frames. macOS throttles a
 * window that is covered by another one, or on a display that is asleep,
 * to a few frames a second; frames measured then say nothing about the
 * site.
 */
export function idleFrame(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((done) => {
        const d: number[] = [];
        let last = 0;
        const tick = (t: number) => {
          if (last) d.push(t - last);
          last = t;
          if (d.length < 20) requestAnimationFrame(tick);
          else done(d.sort((a, b) => a - b)[10]);
        };
        requestAnimationFrame(tick);
      }),
  );
}

/** Over this, the window is being throttled rather than drawing. */
export const THROTTLED_MS = 120;

/**
 * Whether the window is drawing at full rate. Brought to the front and
 * given a moment once if not.
 */
export async function awake(page: Page): Promise<boolean> {
  if ((await idleFrame(page)) <= THROTTLED_MS) return true;
  await page.bringToFront();
  await page.waitForTimeout(1500);
  return (await idleFrame(page)) <= THROTTLED_MS;
}

export type FrameStats = { frames: number; median: number; slow: number; worst: number };

/** Median frame ms, the share of frames over 20ms (in %), and the worst. */
export function frameStats(frames: number[]): FrameStats {
  if (!frames.length) return { frames: 0, median: 0, slow: 0, worst: 0 };
  const s = [...frames].sort((a, b) => a - b);
  return {
    frames: frames.length,
    median: s[Math.floor(s.length / 2)],
    slow: (100 * frames.filter((d) => d > 20).length) / frames.length,
    worst: s[s.length - 1],
  };
}

/** One row of the summary table (`reporter.ts`). */
export type Metric = {
  kind: "swipe" | "splash" | "images";
  page: string;
  viewport: string;
  [key: string]: string | number | boolean;
};

export async function report(info: TestInfo, metric: Metric) {
  await info.attach("perf", { body: JSON.stringify(metric), contentType: "application/json" });
}

/** Waits for the strip to stop moving (20 still frames), up to `ms`. */
export function settle(page: Page, selector = ".strip-scroll", ms = 3000): Promise<number> {
  return page.evaluate(
    ({ selector, ms }) =>
      new Promise<number>((done) => {
        const el = document.querySelector(selector) as HTMLElement;
        let last = el.scrollLeft;
        let still = 0;
        const t0 = performance.now();
        const step = () => {
          const now = el.scrollLeft;
          still = Math.abs(now - last) < 0.5 ? still + 1 : 0;
          last = now;
          if (still >= 20 || performance.now() - t0 > ms) done(now);
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    { selector, ms },
  );
}

/** A trackpad flick: 24 wheel deltas 16ms apart, tailing off. */
export async function wheelFlick(page: Page, sign: 1 | -1, axis: "x" | "y" = "x") {
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < 24; i++) {
    const d = sign * Math.round(40 * Math.exp(-i / 8));
    await page.mouse.wheel(axis === "x" ? d : 0, axis === "y" ? d : 0);
    await page.waitForTimeout(16);
  }
}

/**
 * A finger across the strip from `x0` to `x1` over `ms`, then lifted.
 *
 * WebKit has no `Touch` constructor, so the events are built by hand, with
 * the pointer events a real finger sends. A synthetic touch does not scroll
 * anything, so the strip follows the finger 1:1 here, as iOS scrolls it
 * natively; what happens after the lift is the strip's own code.
 */
export function touchSwipe(page: Page, x0: number, x1: number, ms: number, axis: "x" | "y" = "x") {
  return page.evaluate(
    async ({ x0, x1, ms, axis }) => {
      const el =
        axis === "x"
          ? (document.querySelector(".strip-scroll") as HTMLElement)
          : (document.scrollingElement as HTMLElement);
      const target = axis === "x" ? el : document.elementFromPoint(innerWidth / 2, innerHeight / 2) ?? document.body;
      const across = axis === "x" ? innerHeight / 2 : innerWidth / 2;
      const at = (p: number) => (axis === "x" ? { clientX: p, clientY: across } : { clientX: across, clientY: p });
      const touch = (p: number) => ({ identifier: 1, target, ...at(p) });
      const fire = (type: string, p: number, down: boolean) => {
        const e = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(e, {
          touches: { value: down ? [touch(p)] : [] },
          targetTouches: { value: down ? [touch(p)] : [] },
          changedTouches: { value: [touch(p)] },
        });
        target.dispatchEvent(e);
      };
      const ptr = (type: string, p: number) =>
        target.dispatchEvent(
          new PointerEvent(type, { bubbles: true, pointerType: "touch", pointerId: 7, isPrimary: true, ...at(p) }),
        );
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      const start = axis === "x" ? el.scrollLeft : el.scrollTop;
      ptr("pointerdown", x0);
      fire("touchstart", x0, true);
      const t0 = performance.now();
      let p = x0;
      for (;;) {
        await frame();
        const k = Math.min(1, (performance.now() - t0) / ms);
        p = x0 + (x1 - x0) * k;
        if (axis === "x") el.scrollLeft = start + (x0 - p);
        else el.scrollTop = start + (x0 - p);
        ptr("pointermove", p);
        fire("touchmove", p, true);
        if (k >= 1) break;
      }
      ptr("pointerup", p);
      fire("touchend", p, false);
    },
    { x0, x1, ms, axis },
  );
}

/**
 * The strip's screens: where each one sits, as the strip itself reads it
 * (`data-at` when the deck has pinned it, `leftOf` in `strip.tsx`), and
 * the furthest the strip can scroll.
 */
export function screens(page: Page): Promise<{ width: number; max: number; at: number[] }> {
  return page.evaluate(() => {
    const el = document.querySelector(".strip-scroll") as HTMLElement;
    const at = Array.from(el.children as HTMLCollectionOf<HTMLElement>).map((c) =>
      c.dataset.at !== undefined ? Number(c.dataset.at) : c.offsetLeft,
    );
    return { width: el.clientWidth, max: el.scrollWidth - el.clientWidth, at };
  });
}
