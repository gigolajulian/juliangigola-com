"use client";

import * as React from "react";
import loader from "@/image-loader";
import { burst } from "@/components/splash/burst-splash";
import { split } from "@/components/splash/split-splash";
import { HERO } from "@/lib/v3";
import { keepNames } from "@/lib/keep-names";

/* `?splash=burst`: the run of frames (the portfolio's first covers,
   `SPLASH_RUN`, passed in from the server), then the hero's first
   photograph, each sized for a whole screen: [phone, wider]. The hero
   goes as the page's whole ladder (`deviceSizes` in next.config.ts), so
   the splash asks for the very copy the hero's <Image> and its preload
   will (`home.tsx`): one download, where 1080 against 1280 was two. */
/* At 85, not the site's 78: these are already the `-w1080` copies, so 78
   was a second pass of loss on a frame the window holds up for a second. */
const sized = (run: string[]) => run.map((src) => [loader({ src, width: 640, quality: 85 }), loader({ src, width: 1080, quality: 85 })]);
const LADDER = [640, 1280, 1920, 2500];
const HERO_FULL = {
  d: LADDER.map((width): [number, string] => [width, loader({ src: HERO[0].d.src, width })]),
  l: LADDER.map((width): [number, string] => [width, loader({ src: HERO[0].l.src, width })]),
};

/* ── the opening ──────────────────────────────────────────────────
 * The splash is decided by the inline script in `layout.tsx` before the
 * first paint (a first visit, not admin, no reduced motion, unless
 * `?v3motion=0`) and played by `split-splash.ts` on the homepage and
 * `burst-splash.ts` elsewhere, both run as the document is read. The
 * stylesheet keeps this layer hidden unless that script has set
 * `data-intro`, so a visitor with no JavaScript is never shut behind a
 * curtain that cannot lift.
 * ─────────────────────────────────────────────────────────────── */

/* Once a visit: `sessionStorage` remembers the splash has played. */
function seen() {
  if (document.documentElement.dataset.intro !== "1") return;
  try {
    sessionStorage.setItem("jg-intro", "1");
  } catch {}
}

/* The sheet and its script go in as HTML: React leaves the inside of
   `dangerouslySetInnerHTML` alone when it hydrates, so the frames the
   script has added are not "corrected" away, and a script there runs
   only from the server's HTML, never again on a client render. */
const sheet = (frames: string[]) =>
  '<div class="jg-sheet-ground"></div>' +
  `<script>${keepNames(`(${seen.toString()})();(${burst.toString()})(${JSON.stringify(sized(frames))},${JSON.stringify(HERO_FULL)});(${split.toString()})(${JSON.stringify(sized(frames))},${JSON.stringify(HERO_FULL)})`)}</script>`;

export function Intro({ run: frames }: { run: string[] }) {
  return (
    <>
      {/* The one rule that cannot wait for the stylesheet. The layer is in
          the server's HTML and the styles are in separate files, so there
          is a window between the document arriving and the CSS applying
          in which it has no rules at all and would lay itself out in the
          flow. Carried inline it is there from the first byte, and
          `[data-intro] #jg-intro` in the stylesheet still wins on
          specificity when it comes. */}
      <style>{"#jg-intro{display:none}"}</style>
      <div id="jg-intro" aria-hidden="true">
        {/* By hydration the script has filled it, which React reports as a
            mismatch it will not patch; that is the point. */}
        <div className="jg-sheet-wrap" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: sheet(frames) }} />
      </div>
    </>
  );
}
