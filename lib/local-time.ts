"use client";

import * as React from "react";
import { TZ } from "@/lib/time-zone";

/** My local time (f2), to the minute. Empty until mounted, so the server and the first paint agree. Both footers show it. */
export function useLocalTime() {
  const [t, setT] = React.useState("");
  React.useEffect(() => {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    const set = () => setT(f.format(new Date()));
    set();
    const id = setInterval(set, 30000);
    return () => clearInterval(id);
  }, []);
  return t;
}
