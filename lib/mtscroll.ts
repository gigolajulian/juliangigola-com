/** The v4 homepage on trial: `?mtscroll=1` / `?mtscroll=0` (head script, app/layout.tsx). */
export const mtscroll = () => typeof document !== "undefined" && "mtscroll" in document.documentElement.dataset;
