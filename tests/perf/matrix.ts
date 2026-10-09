import type { BrowserContextOptions } from "@playwright/test";

/**
 * What the suite runs against: every page a visitor lands on, at every
 * screen size from the smallest iPhone still in use to a 27" monitor.
 */

/** The pages. One of each template, and the homepage's Contact screen. */
export const PAGES = [
  "/",
  "/#contact",
  "/portfolio",
  "/portfolio/editorial", // a discipline
  "/portfolio/nova", // a project
  "/portfolio/video",
  "/model-digitals", // a booking page
  "/book",
  "/legal",
] as const;

export type Viewport = {
  name: string;
  width: number;
  height: number;
  scale: number;
  /** A finger, not a pointer: touch events and `(pointer: coarse)`. */
  touch: boolean;
};

export const VIEWPORTS: Viewport[] = [
  { name: "iphone-se", width: 375, height: 667, scale: 2, touch: true },
  { name: "iphone-18", width: 402, height: 874, scale: 3, touch: true },
  { name: "iphone-18-pro-max", width: 440, height: 956, scale: 3, touch: true },
  { name: "ipad-portrait", width: 820, height: 1180, scale: 2, touch: true },
  { name: "ipad-landscape", width: 1180, height: 820, scale: 2, touch: true },
  { name: "laptop-1440", width: 1440, height: 900, scale: 2, touch: false },
  { name: "desktop-1920", width: 1920, height: 1080, scale: 1, touch: false },
  { name: "desktop-2560", width: 2560, height: 1440, scale: 1, touch: false },
];

/** Below Tailwind's `sm` the homepage and the strips stack down the page. */
export const stacked = (v: Viewport) => v.width < 640;

/**
 * The context for a viewport. Firefox has no mobile emulation, so there a
 * phone is a narrow window with touch.
 */
export function contextFor(v: Viewport, browserName: string): BrowserContextOptions {
  return {
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.scale,
    hasTouch: v.touch,
    isMobile: v.touch && browserName !== "firefox",
  };
}
