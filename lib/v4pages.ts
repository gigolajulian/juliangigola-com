import * as React from "react";

/** The inner-pages plan on trial: `?v4pages` turns every key on for the tab,
    `?v4pages=s1,foot` only those, `?v4pages=0` off (head script, app/layout.tsx).
    s1: the phone book bar on service pages. s2: their list rows as numbered rows.
    a2: About's marks on the charcoal band. m2p: behind the scenes on project pages.
    foot: the V4 ending on inner pages. next: the next project as a full stage.
    view: the frame viewer on project pages. */
export const V4PAGES = "s1 s2 a2 m2p foot next view";

export const v4pages = (key: string) =>
  typeof document !== "undefined" && !!document.documentElement.dataset.v4pages?.split(" ").includes(key);

const never = () => () => {};
/** The flag for rendering: false on the server and the first paint, so a page with the flag off keeps its markup. */
export const useV4pages = (key: string) => React.useSyncExternalStore(never, () => v4pages(key), () => false);
