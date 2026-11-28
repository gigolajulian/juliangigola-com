import * as React from "react";
import { noSubscribe } from "@/lib/utils";

/* `data-ds` on <html>: the design system preview (Julian's approved mock, 2026-11-28). Off for everyone;
   `?ds` or `?ds=1` turns it on for the tab, `?ds=0` off again. Every visible rule of the preview sits in
   app/styles/ds.css under `html[data-ds]`, so a tab without the flag gets the site as it is. */
export const DS_HEAD = `(function(){try{var k="jg-ds",v=location.search.match(/[?&]ds(?:=([01]))?(?:&|$)/);if(v)sessionStorage.setItem(k,v[1]==="0"?"0":"1");if(sessionStorage.getItem(k)==="1")document.documentElement.dataset.ds=""}catch(e){}})()`;

/** Whether the tab has the preview on (client only). */
export const dsOn = () => typeof document !== "undefined" && "ds" in document.documentElement.dataset;

/** The flag for rendering: false on the server and the first paint, so a page with the flag off keeps its markup. */
export const useDs = () => React.useSyncExternalStore(noSubscribe, dsOn, () => false);
