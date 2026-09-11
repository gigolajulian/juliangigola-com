"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

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

export function PhotoNotice() {
  // A timestamp rather than a boolean: right-clicking a second photograph
  // while the notice is already up has to restart the clock, and setting a
  // flag that is already `true` changes nothing and re-runs no effect.
  const [raisedAt, setRaisedAt] = React.useState(0);

  React.useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      // `closest`, not `tagName`: a frame is often behind a link or a figure,
      // and the event target is whatever sits on top of it.
      const target = e.target as HTMLElement | null;
      if (!target?.closest("img")) return;

      e.preventDefault();
      setRaisedAt(Date.now());
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
    if (!raisedAt) return;
    const id = window.setTimeout(() => setRaisedAt(0), DWELL_MS);
    return () => window.clearTimeout(id);
  }, [raisedAt]);

  const shown = raisedAt !== 0;

  return (
    <div
      // `status`, not `alert`: this is a remark about what just happened, and
      // an assertive live region would cut off whatever a screen reader was
      // already saying. Rendered always so the region exists before it has
      // anything to say — one mounted at the same moment as its text is not
      // reliably announced.
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-6 sm:bottom-10",
        "transition-opacity duration-200 ease-[var(--ease-out-strong)] motion-reduce:transition-none",
        shown ? "opacity-100" : "opacity-0",
      )}
    >
      {shown ? (
        // Inverted rather than another dark panel: this has to read as an
        // interruption over a photograph, and the site's one light surface
        // is already the primary button. Square, like every other edge here.
        //
        // Sentence case, not the `label` treatment the rest of the chrome
        // uses. This is a sentence of plain English making a legal claim, and
        // sixty-odd characters of 11px caps at 0.14em is a thing to decipher
        // rather than read.
        <p className="max-w-sm bg-foreground px-5 py-4 text-sm leading-snug text-background">
          This photo is Copyright &copy; {new Date().getFullYear()} Julian Gigola. All rights
          reserved.
        </p>
      ) : null}
    </div>
  );
}
