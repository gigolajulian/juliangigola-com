"use client";

import * as React from "react";

/* A clause named in the address opens itself.
 *
 * The legal page's clauses are `<details>` (`legal.tsx`), and every one of
 * them has an anchor so it can be cited. Chrome opens a `<details>` for a
 * fragment inside it only in some versions and not at all for a fragment
 * that *is* it, which would land `/legal#terms-ownership` on a closed lid
 * and read as a broken link. Twelve lines rather than trusting that.
 *
 * On load and on every hash change after it, since the page links between
 * its own clauses. `scrollIntoView` because the browser has already done
 * its scrolling by the time the lid is open. */
export function OpenOnHash() {
  React.useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      const box = el?.closest?.("details");
      if (!box) return;
      if (!box.open) box.open = true;
      box.scrollIntoView({ block: "start", behavior: "instant" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
