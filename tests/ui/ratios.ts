import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { skipSplash } from "../perf/helpers";

/* The six screen shapes every feature is checked at (HANDOFF-qa.md, the
   standing rule), plus the short desktop where /book draws at 80%. */
export type Ratio = { name: string; width: number; height: number; scale: number; touch: boolean };

export const RATIOS: Ratio[] = [
  { name: "phone", width: 390, height: 844, scale: 3, touch: true },
  { name: "phone-land", width: 844, height: 390, scale: 3, touch: true },
  { name: "ipad", width: 820, height: 1180, scale: 2, touch: true },
  { name: "ipad-land", width: 1180, height: 820, scale: 2, touch: true },
  { name: "laptop", width: 1440, height: 900, scale: 2, touch: false },
  { name: "wide", width: 2560, height: 1080, scale: 1, touch: false },
];
export const SHORT: Ratio = { name: "short", width: 1280, height: 720, scale: 1, touch: false };

/** A page at a ratio, Pacific time, the splash and the intro skipped. */
export async function open(browser: Browser, browserName: string, r: Ratio): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({
    viewport: { width: r.width, height: r.height },
    deviceScaleFactor: r.scale,
    hasTouch: r.touch,
    isMobile: r.touch && r.width < 1000 && browserName !== "firefox",
    timezoneId: "America/Los_Angeles",
    colorScheme: "dark",
  });
  await skipSplash(ctx);
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("jg-intro", "1");
    } catch {}
  });
  return { ctx, page: await ctx.newPage() };
}

/** A phone held sideways gets the "turn upright" screen over the page
    (`.turn-upright`, app/styles/devices.css), by design: checked here, and
    the caller stops. Firefox cannot emulate a coarse pointer, so there it
    would be an 844x390 desktop window, which no visitor has: skipped. */
export async function upright(page: Page, r: Ratio, browserName: string): Promise<boolean> {
  if (r.name !== "phone-land") return false;
  test.skip(browserName === "firefox", "Firefox cannot emulate a phone held sideways");
  await expect(page.locator(".turn-upright"), "the turn-upright screen").toBeVisible();
  return true;
}

/** Errors the page throws or logs. Third parties' own noise is left out. */
export function errorsOn(page: Page): string[] {
  const out: string[] = [];
  page.on("pageerror", (e) => out.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/cal\.com|cloudflareinsights|Failed to load resource/i.test(t)) return;
    /* CI's Linux runners have no GPU, so headless Firefox there has no
       WebGL and says so. The page carries on without it. */
    if (/unable to create webgl context/i.test(t)) return;
    out.push(`console: ${t.slice(0, 200)}`);
  });
  return out;
}
