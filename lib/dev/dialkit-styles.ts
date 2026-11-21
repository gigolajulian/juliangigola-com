import * as React from "react";

/* DialKit's stylesheet, on the dev server only. Imported the plain way it
   went to every visitor in production, where the panels are never drawn:
   55kB and 591 rules for the browser to check every element against on
   every style pass, opening with an `@import` of Google Fonts that the
   site's own policy blocks (an error in every visitor's console). Julian:
   a first visit lagged. In production this branch is gone from the build. */
export function useDialKitStyles() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") void import("dialkit/styles.css");
  }, []);
}
