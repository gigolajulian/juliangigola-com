"use client";

import * as React from "react";
import { dsOn } from "@/lib/flags/ds";

/* ds: one question open at a time. The browser's own exclusive group (`name` on <details>), set only with
   the flag on so the page's markup stays as it is without it. The opening itself is CSS (ds.css). */
export function DsFaq() {
  React.useEffect(() => {
    if (dsOn()) document.querySelectorAll<HTMLDetailsElement>(".sv-row details").forEach((d) => (d.name = "ds-faq"));
  }, []);
  return null;
}
