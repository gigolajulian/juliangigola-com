"use client";

import * as React from "react";

/**
 * Brings a requested Content field into view and flashes it. After a paint,
 * because switching to the Content view is what renders the field.
 */
export function useFoundField(wanted: { anchor: string; nonce: number } | null) {
  React.useEffect(() => {
    if (!wanted) return;
    const id = requestAnimationFrame(() => {
      const el = document.getElementById(`field-${wanted.anchor}`);
      if (!el) return;
      // At most one field is marked: React may replace the node whose
      // listener would have cleared it.
      document.querySelectorAll("[data-found]").forEach((n) => n.removeAttribute("data-found"));
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      // An attribute, not a class: React rewrites `className` on the next
      // render. Cleared and reflowed first so the same row twice restarts it.
      el.removeAttribute("data-found");
      void el.offsetWidth;
      el.setAttribute("data-found", "");
      el.addEventListener("animationend", () => el.removeAttribute("data-found"), { once: true });
    });
    return () => cancelAnimationFrame(id);
  }, [wanted]);
}
