"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { matches } from "@/lib/device";
import { THEME_COLOR } from "@/lib/theme-color";

/* ── the numerals, and the hand that focuses them ──────────────────
 * The 404 opens out of focus: the numerals sit under 16px of blur at 78%,
 * like a frame the lens has not found yet. Moving the pointer towards them
 * pulls them sharp — proximity, not hover, so they resolve as the hand
 * approaches rather than snapping when it arrives — and a readout in the
 * foot of the page reports the focus as a percentage until it locks.
 *
 * Written straight to the nodes on every move, like the wordmark handoff in
 * `site-header.tsx`: a `setState` per mousemove would re-render the page to
 * move a blur. The readout and the requested path are plain elements the
 * server renders with placeholders; this fills them in.
 *
 * Only where there is a pointer to follow. On a touch screen — or before any
 * script runs — the numerals are simply sharp: a phone cannot drag a cursor
 * across them, and a 404 that stays blurred is a bug, not a mood.
 * ─────────────────────────────────────────────────────────────── */

const MAX_BLUR = 16;

export function NotFoundScene({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  /* A notFound() under a dynamic segment is served as Next's bare error
     shell and rendered on the client, where the layout's inline theme
     script never runs. Same logic, before this tree's first paint. */
  React.useLayoutEffect(() => {
    const html = document.documentElement;
    if (html.dataset.theme) return;
    let t = null;
    try {
      t = sessionStorage.getItem("theme");
    } catch {}
    const l = t === "light" || (t !== "dark" && matchMedia("(prefers-color-scheme: light)").matches);
    html.dataset.theme = l ? "light" : "dark";
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", l ? THEME_COLOR.light : THEME_COLOR.dark));
  }, []);

  React.useEffect(() => {
    const scene = ref.current;
    if (!scene) return;
    const numerals = scene.querySelector<HTMLElement>("[data-numerals]");
    const readout = scene.querySelector<HTMLElement>("[data-focus-readout]");
    const path = scene.querySelector<HTMLElement>("[data-requested-path]");
    if (path) path.textContent = (pathname || "/lost").toUpperCase();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);

    if (
      !numerals ||
      !matches("fine") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      if (readout) readout.textContent = "FOCUS LOCKED";
      return () => window.removeEventListener("keydown", onKey);
    }

    // Out of focus to begin with, only now that we know a hand can fix it.
    numerals.style.filter = `blur(${MAX_BLUR}px)`;
    numerals.style.opacity = "0.78";
    let last = -1;

    const onMove = (e: PointerEvent) => {
      const r = numerals.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(e.clientX - cx, e.clientY - cy);
      // How far out the pull starts: most of the numerals' own width, with a
      // floor so a narrow window is not a pixel-hunt.
      const reach = Math.max(r.width, 420) * 0.85;
      const f = Math.max(0, 1 - d / reach);
      numerals.style.filter = `blur(${(1 - f) * MAX_BLUR}px)`;
      numerals.style.opacity = String(0.74 + f * 0.26);

      const pct = Math.round(f * 100);
      // Locked: the slate's dots stop blinking and hold (v3.css).
      scene.toggleAttribute("data-locked", pct > 92);
      if (readout && pct !== last) {
        last = pct;
        readout.textContent =
          pct > 92 ? "FOCUS LOCKED" : `FOCUS ${String(pct).padStart(3, "0")}%`;
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [pathname, router]);

  return <div ref={ref}>{children}</div>;
}
