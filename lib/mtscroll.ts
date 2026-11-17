/** The v4 homepage on trial: `?mtscroll=1` / `?mtscroll=0` (head script, app/layout.tsx). */
export const mtscroll = () => typeof document !== "undefined" && "mtscroll" in document.documentElement.dataset;
/** Build switch: with NEXT_PUBLIC_V4_HOME=1 the v4 home is the home and the server renders it. Off: nothing changes. */
export const V4_HOME = process.env.NEXT_PUBLIC_V4_HOME === "1";
