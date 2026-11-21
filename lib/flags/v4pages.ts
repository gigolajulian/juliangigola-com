import * as React from "react";

/** The inner-pages plan. s1, s2, a2, m2p, foot, next, c1, s4 and p3 went live for everyone and are folded into the
    pages (2026-11-21). What is left is on trial: `?v4pages` turns every key on for the tab, `?v4pages=tilt` only
    those, `?v4pages=0` off (head script, app/layout.tsx).
    With no choice made in the tab, view is on wherever the V4 home is on (lib/v4-home/switch.ts).
    view: the frame viewer on project pages (components/portfolio/project-viewer.tsx, components/site/page-fly.tsx).
    tilt: the view leans toward the mouse, the hero's pointer depth toned down (components/portfolio/tilt.tsx). On trial.
    snd: the song previews on Cover art. Opt-in only: `?v4pages=c1,snd`. Not in the list below, so a bare
    `?v4pages` never turns sound on. */
export const V4PAGES = "view tilt";

/** The head script that sets `data-v4pages` before the first paint (app/layout.tsx renders it inline). */
export const V4PAGES_HEAD = `(function(){try{var k="jg-v4pages",v=(location.search.match(/[?&]v4pages(?:=([a-z0-9,-]*))?(?:&|$)/)||[]),all="${V4PAGES}";if(v[0])sessionStorage.setItem(k,v[1]==="0"?"":!v[1]||v[1]==="1"?all:v[1].split(",").join(" "));v=sessionStorage.getItem(k);if(v==null)v="mtscroll" in document.documentElement.dataset?all.replace(" tilt",""):"";if(v)document.documentElement.dataset.v4pages=v}catch(e){}})()`;

export const v4pages = (key: string) =>
  typeof document !== "undefined" && !!document.documentElement.dataset.v4pages?.split(" ").includes(key);

const never = () => () => {};
/** The flag for rendering: false on the server and the first paint, so a page with the flag off keeps its markup. */
export const useV4pages = (key: string) => React.useSyncExternalStore(never, () => v4pages(key), () => false);
