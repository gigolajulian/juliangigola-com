import * as React from "react";

/* ── ⟡ in a title ─────────────────────────────────────────────────
 * The display face has no ⟡, so the browser drew it from a fallback font
 * that sat below the capitals and changed from one system to the next.
 * Drawn here instead: a concave four-pointed star, as tall as a capital
 * and standing on the baseline, in the title's own colour. The character
 * stays in the text for anything reading it; only its drawing is swapped.
 * ─────────────────────────────────────────────────────────────── */

const STAR = "⟡";

export function TitleGlyphs({ text }: { text: string }) {
  if (!text.includes(STAR)) return text;
  return text.split(STAR).map((part, i) => (
    <React.Fragment key={i}>
      {i > 0 ? (
        <>
          <span className="sr-only">{STAR}</span>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinejoin="round"
            /* Univers Condensed capitals stand about 0.8em; the star matches them
               and sits on the baseline like a letter. */
            className="inline-block h-[0.86em] w-[0.86em] align-[-0.02em]"
          >
            <path d="M12 1.2Q13.7 10.3 22.8 12Q13.7 13.7 12 22.8Q10.3 13.7 1.2 12Q10.3 10.3 12 1.2Z" />
          </svg>
        </>
      ) : null}
      {part}
    </React.Fragment>
  ));
}
