"use client";

import { gsap } from "gsap";
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

/** Long enough to read twenty words, short enough not to be in the way. */
const DWELL_MS = 2600;
/** Two right clicks this close together are one ask. Julian, 2026-10-19:
    the notice answers the second, the first only keeps the menu shut. */
const AGAIN_MS = 500;

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
  } | null>(null);

  React.useEffect(() => {
    let first = 0;
    const onContextMenu = (e: MouseEvent) => {
      // `closest`, not `tagName`: a frame is often behind a link or a figure,
      // and the event target is whatever sits on top of it.
      const target = e.target as HTMLElement | null;
      if (!target?.closest("img")) return;

      e.preventDefault();
      const now = e.timeStamp;
      if (now - first > AGAIN_MS) {
        first = now;
        return;
      }
      first = 0;
      setRaised({ at: Date.now(), x: e.clientX, y: e.clientY, open: true });
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

  React.useEffect(() => {
    if (!raised?.open) return;
    const id = window.setTimeout(
      () => setRaised((r) => r && { ...r, open: false }),
      DWELL_MS,
    );
    return () => window.clearTimeout(id);
  }, [raised]);

  const shown = raised?.open === true;
  const box = React.useRef<HTMLDivElement>(null);

  /* In: the block opens out of the click, a wipe from the corner nearest
     the pointer, and the sentence rises from behind its lower edge. Out:
     it lifts and fades where it was. Every raise starts it from closed. */
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { autoAlpha: shown ? 1 : 0 });
      return;
    }
    if (!shown) {
      const out = gsap.to(el, {
        autoAlpha: 0,
        y: -6,
        duration: 0.22,
        ease: "power2.in",
      });
      return () => void out.kill();
    }
    const plate = el.querySelector("p");
    const line = el.querySelector("[data-line]");
    const tl = gsap
      .timeline()
      .set(el, { autoAlpha: 1, y: 0 })
      .fromTo(
        plate,
        { clipPath: "inset(0 100% 100% 0)" },
        { clipPath: "inset(0 0% 0% 0)", duration: 0.42, ease: "expo.out" },
      )
      .from(line, { yPercent: 110, duration: 0.5, ease: "power3.out" }, 0.1);
    return () => void tl.kill();
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
  const BOX_W = 272; // `max-w-[17rem]`
  const BOX_H = 64; // three short lines plus padding
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
      style={{ ...position, visibility: "hidden" }}
      // No transition on position: it is placed where the click was and
      // must not be seen travelling there from wherever the last one was.
      className="pointer-events-none fixed z-50"
    >
      {raised ? (
        // Inverted rather than another dark panel: this has to read as an
        // interruption over a photograph, and the site's one light surface
        // is already the primary button. Square, like every other edge here.
        //
        // Sentence case, not the `label` treatment the rest of the chrome
        // uses. This is a sentence of plain English making a legal claim, and
        // sixty-odd characters of 11px caps at 0.14em is a thing to decipher
        // rather than read. Smaller.
        //
        // Kept through the fade out; keyed by the raise so each one is
        // announced afresh.
        <p
          key={raised.at}
          className="max-w-[17rem] overflow-hidden bg-foreground px-3 py-2 text-left text-xs leading-snug text-background"
        >
          <span data-line className="block">
            This photo is Copyright &copy; {year} Julian Gigola. All rights
            reserved.
          </span>
        </p>
      ) : null}
    </div>
  );
}
