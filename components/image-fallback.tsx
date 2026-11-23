"use client";

import * as React from "react";
import { plainSrc } from "@/image-loader";

/* ── when the resizer is blocked, the photograph still shows ──────
 * Every picture on the site is addressed through `/cdn-cgi/image/...`
 * (`image-loader.ts`). Content blockers match that path — it is the same
 * prefix Cloudflare uses for its beacon — so on a laptop running one, the
 * photographs are the one thing on the page that does not arrive, and the
 * site reads as broken.
 *
 * A blocked request fires `error` on the image. Resource errors do not
 * bubble, so this listens in the capture phase at the window, which is one
 * listener for every image on the site rather than a prop on each. The
 * transformed URL carries its own source inside it, so the plain file is
 * the tail of the path; `srcset` goes first, or the browser simply picks
 * another transformed candidate and the swap does nothing.
 *
 * Marked once so a picture that is genuinely missing fails quietly rather
 * than looping.
 *
 * A picture in the page's HTML can fail before this mounts, and its
 * `error` is gone by then: on a branch preview a photograph that exists
 * only on the branch 404s on the live zone within a few milliseconds
 * (`image-loader.ts`, `ORIGIN`), and stayed an empty box. So the ones
 * already broken are swept once on mount.
 * ─────────────────────────────────────────────────────────────── */
export function ImageFallback() {
  React.useEffect(() => {
    const plain = (img: EventTarget | null) => {
      if (!(img instanceof HTMLImageElement)) return;
      if (img.dataset.plain !== undefined) return;
      const from = img.currentSrc || img.src;
      const plainFile = plainSrc(from);
      if (!plainFile) return;
      img.dataset.plain = "";
      img.srcset = "";
      img.src = plainFile;
    };
    const onError = (e: Event) => plain(e.target);
    window.addEventListener("error", onError, true);
    for (const img of Array.from(document.images)) if (img.complete && img.naturalWidth === 0) plain(img);
    return () => window.removeEventListener("error", onError, true);
  }, []);
  return null;
}
