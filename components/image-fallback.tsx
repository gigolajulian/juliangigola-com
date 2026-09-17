"use client";

import * as React from "react";

/* ── when the resizer is blocked, the photograph still shows ──────
 * Every picture on the site is addressed through `/cdn-cgi/image/...`
 * (`image-loader.ts`). Content blockers match that path — it is the same
 * prefix Cloudflare uses for its beacon — so on a laptop running one, the
 * photographs are the one thing on the page that does not arrive, and the
 * site reads as broken. Julian's friend saw exactly that.
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
 * ─────────────────────────────────────────────────────────────── */
export function ImageFallback() {
  React.useEffect(() => {
    const onError = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      if (img.dataset.plain !== undefined) return;
      const from = img.currentSrc || img.src;
      const rest = /\/cdn-cgi\/image\/[^/]+\/(.+)$/.exec(from)?.[1];
      if (!rest) return;
      img.dataset.plain = "";
      img.srcset = "";
      img.src = rest.startsWith("http") ? rest : `/${rest}`;
    };
    window.addEventListener("error", onError, true);
    return () => window.removeEventListener("error", onError, true);
  }, []);
  return null;
}
