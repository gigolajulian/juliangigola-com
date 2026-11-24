"use client";

import * as React from "react";

/**
 * Brings a requested Content field into view.
 *
 * DOM only, nothing here sets state, so it is the kind of work an effect is
 * actually for. After a paint, because switching to the Content view is
 * what renders the field in the first place.
 */
export function useFoundField(wanted: { anchor: string; nonce: number } | null) {
  React.useEffect(() => {
    if (!wanted) return;
    const id = requestAnimationFrame(() => {
      const el = document.getElementById(`field-${wanted.anchor}`);
      if (!el) return;
      // At most one field is ever the one you asked for. The listener below
      // normally clears it, but it is attached to a node React is free to
      // replace, so this is what actually guarantees it.
      document
        .querySelectorAll("[data-found]")
        .forEach((n) => n.removeAttribute("data-found"));
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      // An attribute, not a class. `className` on these elements is React's,
      // it rewrites it on the next render and takes the highlight with it,
      // and arriving from the sitemap re-renders by definition because it
      // changes the tab. React leaves attributes it never set alone.
      //
      // Cleared first so it can fire twice: an animation does not restart
      // because the attribute was set again while it was already there, which
      // is exactly what clicking the same row twice does.
      el.removeAttribute("data-found");
      void el.offsetWidth;
      el.setAttribute("data-found", "");
      el.addEventListener(
        "animationend",
        () => el.removeAttribute("data-found"),
        { once: true },
      );
    });
    return () => cancelAnimationFrame(id);
  }, [wanted]);
}
