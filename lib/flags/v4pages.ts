import * as React from "react";

/** The inner-pages plan on trial: `?v4pages` turns every key on for the tab,
    `?v4pages=s1,a2` only those, `?v4pages=0` off (head script, app/layout.tsx).
    With no choice made in the tab, every key but tilt is on wherever the V4 home is on (lib/v4-home/switch.ts).
    s1: the phone book bar on service pages. s2: their list rows as numbered rows.
    a2: About's marks on the charcoal band. m2p: behind the scenes on project pages.
    foot: the V4 ending on inner pages.
    next: the next project as a full stage.
    view: the frame viewer on project pages.
    c1: Cover art in the site's system.
    s4: a campus guide's spots held beside their photo (components/booking/campus-spots.tsx).
    p3: the /portfolio grid's scroll motion (components/portfolio/drift.tsx, app/styles/v4pages.css). On for
    everyone since 2026-11-15; `?v4pages=0` still turns it off for the tab.
    tilt: the view leans toward the mouse, the hero's pointer depth toned down (components/portfolio/tilt.tsx). On trial.
    snd: the song previews on Cover art. Opt-in only: `?v4pages=c1,snd`. Not in the list below, so a bare
    `?v4pages` never turns sound on. */
export const V4PAGES = "s1 s2 a2 m2p foot next view c1 s4 p3 tilt";

/** The head script that sets `data-v4pages` before the first paint (app/layout.tsx renders it inline). */
export const V4PAGES_HEAD = `(function(){try{var k="jg-v4pages",v=(location.search.match(/[?&]v4pages(?:=([a-z0-9,-]*))?(?:&|$)/)||[]),all="${V4PAGES}";if(v[0])sessionStorage.setItem(k,v[1]==="0"?"":!v[1]||v[1]==="1"?all:v[1].split(",").join(" "));v=sessionStorage.getItem(k);if(v==null)v="mtscroll" in document.documentElement.dataset?all.replace(" tilt",""):"p3";if(v)document.documentElement.dataset.v4pages=v}catch(e){}})()`;

export const v4pages = (key: string) =>
  typeof document !== "undefined" && !!document.documentElement.dataset.v4pages?.split(" ").includes(key);

const never = () => () => {};
/** The flag for rendering: false on the server and the first paint, so a page with the flag off keeps its markup. */
export const useV4pages = (key: string) => React.useSyncExternalStore(never, () => v4pages(key), () => false);
