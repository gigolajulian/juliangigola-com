import * as React from "react";

const noop = () => () => {};

/** The time to the minute in the browser, 0 while rendering on the server: dates near a boundary render the same on both, then update. */
export const useClock = () => React.useSyncExternalStore(noop, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);
