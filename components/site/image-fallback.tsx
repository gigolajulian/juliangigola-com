"use client";

import * as React from "react";
import { plainSrc } from "@/image-loader";

/* ── when the resizer is blocked, the photograph still shows ──────
 * Content blockers match `/cdn-cgi/image/` (Cloudflare's beacon shares the
 * prefix), so a failed picture swaps to the plain file its URL carries.
 * Resource errors do not bubble: one capture listener on the window covers
 * every image. `srcset` is cleared first, or the browser picks another
 * transformed candidate. Marked once, so a missing file does not loop.
 * Pictures that failed before mount (a branch-only photograph on a preview)
 * are swept once on mount.
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
