"use client";

import * as React from "react";

/* ── the copyright notice ─────────────────────────────────────────
 * Right-clicking a photograph says who owns it instead of offering to
 * save it, and dragging one off the page does nothing.
 *
 * What this is: a deterrent and a statement of ownership. It raises the
 * effort of casually pocketing a frame, and it puts the claim in front of
 * somebody at the moment they reach for one.
 *
 * What it is not: protection. Every image on a web page has already been
 * downloaded by the time it is visible — devtools, the network tab, view
 * source, a screenshot and "save page as" all still work, and nothing a
 * page can do changes that. Treating this as security would be a mistake;
 * the enforceable protection is the copyright itself, which is what the
 * message asserts.
 *
 * One delegated pair of listeners on the document rather than handlers on
 * every `<Image>`. Frames are rendered by the cover, the work index, the
 * band, the galleries and the lightbox — and the lightbox mounts its own
 * after the fact — so anything per-call-site would be a rule that five
 * components have to remember and a sixth will forget.
 * ─────────────────────────────────────────────────────────────── */

/** Long enough to read, short enough not to be in the way (Julian: 3s). */
const DWELL_MS = 3000;
/** Two right clicks this close together are one ask. Julian, 2026-10-19:
    the notice answers the second, the first only keeps the menu shut. */
const AGAIN_MS = 500;
/** gsap's power2.in, expo.out and power3.out, which these fades were first drawn with. */
const EASE = { in: "cubic-bezier(0.55, 0.085, 0.68, 0.53)", expo: "cubic-bezier(0.19, 1, 0.22, 1)", out: "cubic-bezier(0.215, 0.61, 0.355, 1)" };

/** Which frame of which set it is, as a contact sheet labels it: the
    project's title and the frame's place in its strip ("BYTE ME · 03 / 10").
    Empty off a strip (the cover, the lightbox), where there is no count. */
function slugOf(target: HTMLElement) {
  const cell = target.closest(".strip-cell");
  const title = document.querySelector("main h1")?.textContent?.trim();
  if (!cell?.parentElement || !title) return "";
  const frames = [...cell.parentElement.children].filter(
    (c) => c.classList.contains("strip-cell") && c.querySelector("img"),
  );
  const n = frames.indexOf(cell);
  if (n < 0) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${title} · ${pad(n + 1)} / ${pad(frames.length)}`;
}

export function PhotoNotice() {
  /**
   * When it was raised, and where.
   *
   * A timestamp rather than a boolean: right-clicking a second photograph
   * while the notice is already up has to restart the clock, and setting a
   * flag that is already `true` changes nothing and re-runs no effect.
   *
   * The point is the click, so the notice appears where the menu would have
   * — answering the gesture where it was made, rather than making somebody
   * look to the corner of the screen to find out why nothing happened.
   */
  const [raised, setRaised] = React.useState<{
    at: number;
    x: number;
    y: number;
    /** Down again, kept where it was so it fades out there. */
    open: boolean;
    /** The frame reached for, as a contact sheet labels it. */
    slug: string;
  } | null>(null);

  React.useEffect(() => {
    let first = 0;
    const onContextMenu = (e: MouseEvent) => {
      // `closest`, not `tagName`: a frame is often behind a link or a figure,
      // and the event target is whatever sits on top of it.
      const target = e.target as HTMLElement | null;
      if (!target) return;
      /* Julian (2026-10-19): no menu on the page around them either. Text
         fields keep theirs for copy and paste, and a link keeps its own
         (open in a new tab). Only a photograph raises the notice. */
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (!target.closest("img")) {
        if (!target.closest("a")) e.preventDefault();
        return;
      }

      e.preventDefault();
      const now = e.timeStamp;
      if (now - first > AGAIN_MS) {
        first = now;
        return;
      }
      first = 0;
      setRaised({
        at: Date.now(),
        x: e.clientX,
        y: e.clientY,
        open: true,
        slug: slugOf(target),
      });
    };

    // The one path that actually moves a file: dragging a frame to the
    // desktop copies it without ever opening a menu.
    const onDragStart = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest("img")) e.preventDefault();
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
    };
  }, []);

  /* The hand on it holds it up: the dot has poured into it
     (`data-stick="fill"`, `pointer-mark.tsx`), and it going away under
     the hand would drop the liquid. Let go, it stays its full time. */
  const [held, setHeld] = React.useState(false);

  React.useEffect(() => {
    if (!raised?.open || held) return;
    const id = window.setTimeout(
      () => setRaised((r) => r && { ...r, open: false }),
      DWELL_MS,
    );
    return () => window.clearTimeout(id);
  }, [raised, held]);

  const shown = raised?.open === true;
  const box = React.useRef<HTMLDivElement>(null);

  /* In: the panel opens out of the click, a hairline wipe from the corner
     nearest the pointer, and its three lines rise from behind their own
     edges, as the crossing's title does. Out: it lifts and fades. Every
     raise starts it again from closed. */
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    // Visible and opaque, or neither: what gsap's `autoAlpha` set.
    const show = (on: boolean) => {
      el.style.visibility = on ? "visible" : "hidden";
      el.style.opacity = on ? "1" : "0";
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      show(shown);
      return;
    }
    // Never raised yet: closed, with nothing to fade. Animating out from the
    // first paint drew it at the corner for a moment on every page load
    // (QA, live v1.2.18).
    if (!raised) {
      show(false);
      return;
    }
    if (!shown) {
      const out = el.animate(
        [{ opacity: getComputedStyle(el).opacity, transform: "none" }, { opacity: 0, transform: "translateY(-6px)" }],
        { duration: 220, easing: EASE.in },
      );
      el.style.opacity = "0";
      out.onfinish = () => (el.style.visibility = "hidden");
      return () => out.cancel();
    }
    show(true);
    const wipe = el.animate(
      [{ clipPath: "inset(0 100% 100% 0 round 4px)" }, { clipPath: "inset(0 0% 0% 0 round 4px)" }],
      { duration: 420, easing: EASE.expo },
    );
    const lines = [...el.querySelectorAll("[data-line]")].map((l, i) =>
      l.animate([{ transform: "translateY(110%)" }, { transform: "none" }], {
        duration: 500,
        delay: 120 + i * 70,
        easing: EASE.out,
        fill: "backwards",
      }),
    );
    return () => [wipe, ...lines].forEach((a) => a.cancel());
  }, [raised, shown]);

  /**
   * Below and right of the pointer, like the menu it replaces — but never off
   * the screen.
   *
   * Clamped against a fixed estimate of the box rather than a measurement of
   * it. Measuring would mean rendering it at the click point, reading it back
   * in a layout effect and moving it, which is a visible jump for the sake of
   * a few pixels of precision on a label that is gone in under three seconds.
   * The estimate is generous, so the worst case is a notice sitting slightly
   * further inside the edge than it strictly needed to.
   */
  const BOX_W = 236; // `w-[14.75rem]`
  const BOX_H = 92; // three lines plus padding
  const GAP = 12;
  const MARGIN = 16;

  const at = raised;
  const position = at
    ? {
        left: Math.max(
          MARGIN,
          Math.min(at.x + GAP, window.innerWidth - BOX_W - MARGIN),
        ),
        top: Math.max(
          MARGIN,
          Math.min(at.y + GAP, window.innerHeight - BOX_H - MARGIN),
        ),
      }
    : undefined;
  const year = new Date().getFullYear();

  return (
    <div
      // `status`, not `alert`: this is a remark about what just happened, and
      // an assertive live region would cut off whatever a screen reader was
      // already saying. Rendered always so the region exists before it has
      // anything to say — one mounted at the same moment as its text is not
      // reliably announced.
      role="status"
      aria-live="polite"
      ref={box}
      style={{ ...position, visibility: "hidden", opacity: 0 }}
      // No transition on position: it is placed where the click was and
      // must not be seen travelling there from wherever the last one was.
      // A dark plate with a hairline, square, the site's own mono for the
      // small lines and its display face for the name.
      data-stick="fill"
      data-box=""
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      className="fixed z-50 w-[14.75rem] rounded-[4px] border border-foreground/25 bg-background/60 px-3 backdrop-blur-xl backdrop-saturate-150 [:root[data-theme=light]_&]:bg-background/70 py-2.5 text-foreground"
    >
      {/* Said once per raise; the lines below stay through the fade out. */}
      {shown ? (
        <span className="sr-only">
          This photo{raised?.slug ? `, ${raised.slug},` : ""} is Copyright
          &copy; {year} Julian Gigola. All rights reserved.
        </span>
      ) : null}
      {/* In a box of its own: the stuck dot grows and leans an icon's
          direct spans (`pointer.css`), which shoved these off the edge. */}
      <div>
        <span aria-hidden className="block overflow-hidden">
          <span data-line className="label block text-muted-foreground">
            &copy; Copyright {year}
          </span>
        </span>
        <span aria-hidden className="mt-1 block overflow-hidden">
          <span
            data-line
            className="block font-[family-name:var(--font-wordmark)] text-[1.67rem] font-black normal-case leading-[1.15] tracking-[-0.045em]"
          >
            Julian Gigola
          </span>
        </span>
        {/* One line, both ends (Julian, 2026-10-20). At this width the
            set's name never fits beside "All rights reserved", so the
            line keeps the frame's place in it; the name is read out in
            full above. */}
        <span aria-hidden className="notice-foot mt-2 flex gap-2 overflow-hidden border-t border-foreground/15 pt-1.5">
          {raised?.slug ? (
            <span data-line className="label shrink-0 text-muted-foreground">
              {raised.slug.split(" · ").pop()}
            </span>
          ) : null}
          <span data-line className="label ml-auto shrink-0 text-foreground/80">
            All rights reserved
          </span>
        </span>
      </div>
    </div>
  );
}
