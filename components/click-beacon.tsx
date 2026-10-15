"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { MAX_CLICKS, type Beacon } from "@/lib/beacon";

/* ── click beacon ─────────────────────────────────────────────────
 * Feeds /admin's SEO tab its click and scroll map. Per page view it keeps
 * where presses landed (as fractions of the window) and how far down the
 * page got, and sends that once, when the page is left. No cookie, no id.
 *
 * Off for: frames (the SEO tab shows pages in one), automated browsers,
 * and anyone who asks not to be tracked (Global Privacy Control, DNT).
 * The homepage's screens count as pages of their own (`/#sessions`), since
 * each is its own window. Renders nothing.
 * ─────────────────────────────────────────────────────────────── */

const key = () => location.pathname + (location.pathname === "/" ? location.hash : "");

export function ClickBeacon() {
  const pathname = usePathname();

  React.useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (window.top !== window || nav.webdriver || nav.globalPrivacyControl || nav.doNotTrack === "1") return;
    if (/^\/(admin|api)(\/|$)/.test(location.pathname)) return;

    let page = key();
    let depth = 0;
    let clicks: Beacon["c"] = [];
    let opened = false;
    const device = (): Beacon["dev"] =>
      innerWidth >= 1024 && matchMedia("(pointer: fine)").matches ? "desktop" : innerWidth >= 768 ? "tablet" : "phone";
    const measure = () => {
      const h = document.documentElement.scrollHeight;
      depth = Math.max(depth, h > innerHeight ? Math.min(1, (scrollY + innerHeight) / h) : 1);
    };
    const send = () => {
      if (opened && !clicks.length) return;
      measure();
      const body: Beacon = { p: page, v: !opened, d: Math.round(depth * 100) / 100, dev: device(), c: clicks };
      navigator.sendBeacon("/api/beacon", JSON.stringify(body));
      opened = true;
      clicks = [];
    };

    const press = (e: PointerEvent) => {
      if (clicks.length >= MAX_CLICKS) return;
      const t = (e.target as Element | null)?.closest("a, button, [role=button], input, select, textarea, label, img");
      const label = t
        ? (t.getAttribute("aria-label") || (t as HTMLImageElement).alt || t.textContent || t.tagName).replace(/\s+/g, " ").trim()
        : "";
      const r = (n: number) => Math.round(n * 1000) / 1000;
      clicks.push([r(e.clientX / innerWidth), r((e.clientY + scrollY) / innerHeight), label.slice(0, 40)]);
    };
    // A screen change on the homepage is a hash change, not a navigation.
    const moved = () => {
      if (key() === page) return;
      send();
      page = key();
      opened = false;
      depth = 0;
    };
    let frame = 0;
    const scrolled = () => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), measure()));
    };
    const hidden = () => document.visibilityState === "hidden" && send();

    addEventListener("pointerdown", press, { passive: true, capture: true });
    addEventListener("scroll", scrolled, { passive: true });
    addEventListener("hashchange", moved);
    addEventListener("pagehide", send);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      // A client navigation: this page view ends here.
      send();
      removeEventListener("pointerdown", press, { capture: true });
      removeEventListener("scroll", scrolled);
      removeEventListener("hashchange", moved);
      removeEventListener("pagehide", send);
      document.removeEventListener("visibilitychange", hidden);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
