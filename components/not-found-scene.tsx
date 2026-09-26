"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

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
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
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

/* ── the eye on the slate ─────────────────────────────────────────
 * Julian's mark, drawn as `app/icon.svg` draws it: a lens of two arcs
 * meeting in sharp corners, the iris raised so it breaks the top lid,
 * a small pupil. The iris is a hole rather than a black disc, so the page
 * shows through it on either theme, as the tab's black shows through it.
 *
 * It blinks once the page has come up, and then every five to eight
 * seconds, a different wait each time so it reads as a glance rather than
 * a metronome. Not while the intro is still over the page, and not at all
 * for anybody who asks for less motion.
 * ─────────────────────────────────────────────────────────────── */
/** One blink of the mark's lids. The intro calls it on its own beats. */
export const blink = (lids: Element) =>
  lids.animate(
    [
      { transform: "scaleY(1)" },
      { transform: "scaleY(0.06)", offset: 0.45 },
      { transform: "scaleY(1)" },
    ],
    { duration: 240, easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
  );

/* `still`: no blinks of its own. The intro blinks it on its beats. */
export function BlinkingMark({
  className,
  still,
}: {
  className?: string;
  still?: boolean;
}) {
  const lids = React.useRef<SVGGElement>(null);
  const id = React.useId();

  React.useEffect(() => {
    const g = lids.current;
    if (
      !g ||
      still ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let t = 0;
    const next = () => {
      // Still behind the intro: look again shortly.
      if (document.documentElement.dataset.intro !== undefined) {
        t = window.setTimeout(next, 500);
        return;
      }
      blink(g);
      t = window.setTimeout(next, 5000 + Math.random() * 3000);
    };
    // Once the elements are up: the window's load, and the reveal after it.
    const start = () => (t = window.setTimeout(next, 700));
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      window.clearTimeout(t);
    };
  }, [still]);

  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <mask id={id}>
        <rect width="100" height="100" fill="#fff" />
        <circle cx="50" cy="40.9" r="20.7" fill="#000" />
      </mask>
      {/* Shut about the middle of the lens, where lids meet. */}
      <g
        ref={lids}
        data-lids=""
        style={{ transformOrigin: "50px 49.6px" }}
        fill="currentColor"
      >
        <path
          d="M7.2 49.6 A59.9 59.9 0 0 1 92.8 49.6 A59.9 59.9 0 0 1 7.2 49.6 Z"
          mask={`url(#${id})`}
        />
        <circle cx="50" cy="40.9" r="8.6" />
      </g>
    </svg>
  );
}
