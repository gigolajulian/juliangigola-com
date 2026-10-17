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
/** The card's go-ahead: "Continue" on the editorial card (the default since #204), "Confirm this time" on `?classic`. */
export const CONFIRM = /^(Continue|Confirm this time)$/;

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
  /* Cal.com answered from fixtures, not the live account: a deposit there
     (price > 0) or a refused call sends the picker to Cal.com's own form,
     and no day ever draws (CI on #180). A free event, Wednesday to Sunday
     open 10:00 to 17:30 every half hour, Monday and Tuesday closed. */
  await ctx.route("https://api.cal.com/v2/event-types?**", (route) => {
    const slug = new URL(route.request().url()).searchParams.get("eventSlug") ?? "session";
    const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return route.fulfill({ json: { status: "success", data: [{ slug, title, lengthInMinutes: 30, price: 0, locations: [{ type: "attendeeDefined" }] }] } });
  });
  await ctx.route("https://api.cal.com/v2/slots?**", (route) => {
    const q = new URL(route.request().url()).searchParams;
    const data: Record<string, { start: string; end: string }[]> = {};
    const day = new Date(`${q.get("start")!.slice(0, 10)}T12:00:00Z`);
    const end = new Date(`${q.get("end")!.slice(0, 10)}T12:00:00Z`);
    for (; day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
      if (day.getUTCDay() === 1 || day.getUTCDay() === 2) continue;
      const date = day.toISOString().slice(0, 10);
      const at = (m: number) => `${date}T${String(m / 60 | 0).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00.000-07:00`;
      data[date] = Array.from({ length: 16 }, (_, i) => ({ start: at(600 + i * 30), end: at(630 + i * 30) }));
    }
    return route.fulfill({ json: { status: "success", data } });
  });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("jg-intro", "1");
    } catch {}
  });
  return { ctx, page: await ctx.newPage() };
}

/** A phone held sideways gets the homepage laid out for it (`lying`,
    app/styles/variants.css), no "turn upright" screen since #134. Its
    booking card shows the week, then a day's times, so the Confirm these
    specs drive is not on screen until a day is picked: phone-land is
    checked by QA's screenshots, and the caller stops here. */
export async function upright(page: Page, r: Ratio, browserName: string): Promise<boolean> {
  if (r.name !== "phone-land") return false;
  test.skip(browserName === "firefox", "Firefox cannot emulate a phone held sideways");
  await expect(page.locator(".turn-upright"), "no turn-upright screen").toHaveCount(0);
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

/** Picks an open time, as a person would: on a phone the wheel of the
    day's times (`[data-part="wheel"]`, time-picker.tsx), elsewhere a
    time's button; the first, or with `last` the last. */
export async function pickTime(page: Page, last = false): Promise<void> {
  const wheel = page.locator("select[data-part=wheel]:visible");
  if (await wheel.count()) {
    const times = await wheel.locator("option:not([disabled])").evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
    await wheel.selectOption(last ? times[times.length - 1] : times[0]);
  } else {
    const slots = page.locator("[data-slot]:not([disabled]):visible");
    await (last ? slots.last() : slots.first()).click();
  }
}
