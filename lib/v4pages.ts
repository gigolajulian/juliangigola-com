import * as React from "react";

/** The inner-pages plan on trial: `?v4pages` turns every key on for the tab,
    `?v4pages=s1,a2` only those, `?v4pages=0` off (head script, app/layout.tsx).
    s1: the phone book bar on service pages. s2: their list rows as numbered rows.
    a2: About's marks on the charcoal band. m2p: behind the scenes on project pages.
    p3: the /portfolio grid's scroll motion (v4-drift.tsx, app/styles/v4pages.css). On for
    everyone since 2026-11-15; `?v4pages=0` still turns it off for the tab. */
export const V4PAGES = "s1 s2 a2 m2p p3";

export const v4pages = (key: string) =>
  typeof document !== "undefined" && !!document.documentElement.dataset.v4pages?.split(" ").includes(key);

const never = () => () => {};
/** The flag for rendering: false on the server and the first paint, so a page with the flag off keeps its markup. */
export const useV4pages = (key: string) => React.useSyncExternalStore(never, () => v4pages(key), () => false);
