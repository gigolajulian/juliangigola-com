import * as React from "react";

/** The inner-pages plan on trial: `?v4pages` turns every key on for the tab,
    `?v4pages=foot,next` only those, `?v4pages=0` off (head script, app/layout.tsx).
    foot: the V4 ending on inner pages. next: the next project as a full stage.
    view: the frame viewer on project pages. c1: Cover art in the site's system. */
export const V4PAGES = "foot next view c1";

export const v4pages = (key: string) =>
  typeof document !== "undefined" && !!document.documentElement.dataset.v4pages?.split(" ").includes(key);

const never = () => () => {};
/** The flag for rendering: false on the server and the first paint, so a page with the flag off keeps its markup. */
export const useV4pages = (key: string) => React.useSyncExternalStore(never, () => v4pages(key), () => false);
