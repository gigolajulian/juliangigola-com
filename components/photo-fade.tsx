"use client";

import * as React from "react";

/* ── pictures arrive, they do not pop ─────────────────────────────
 * A lazily loaded photograph used to appear the instant its bytes did: one
 * frame the placeholder colour, the next the picture. Every `<img
 * data-fade>` now starts transparent and fades up over 480ms once it has
 * loaded — see the rule in `globals.css`.
 *
 * "Once it has loaded" is the one thing CSS cannot know, so this listens
 * for `load` on the document in the capture phase (image load events do
 * not bubble) and marks the element. Pictures that were already complete
 * when the listener arrived — from cache, or decoded before hydration — are
 * swept on mount so they are never left invisible.
 *
 * Not on anything above the fold: a picture that is the largest paint on
 * the page must not spend 480ms invisible, so those are left without the
 * attribute and appear as they always did.
 * ─────────────────────────────────────────────────────────────── */

const LOADED = "data-loaded";

export function PhotoFade() {
  React.useEffect(() => {
    const mark = (img: HTMLImageElement) => img.setAttribute(LOADED, "");
    const onLoad = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLImageElement && t.hasAttribute("data-fade")) mark(t);
    };
    document.addEventListener("load", onLoad, true);
    const sweep = () =>
      document
        .querySelectorAll<HTMLImageElement>("img[data-fade]")
        .forEach((img) => img.complete && img.naturalWidth > 0 && mark(img));
    sweep();
    // Client-side navigation mounts new pictures without a load event
    // reaching a listener that was attached earlier — some are cached and
    // complete before React commits them. Sweep again after each commit.
    const mo = new MutationObserver(sweep);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("load", onLoad, true);
      mo.disconnect();
    };
  }, []);
  return null;
}
