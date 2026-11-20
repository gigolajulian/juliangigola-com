"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { mtscroll } from "@/lib/v4-home/switch";
import type { MtData } from "@/lib/v4-home/data";

/* Three ways to the v4 home. `/?mtscroll=1` is rewritten on the server to
   app/home-v4 (next.config.ts). A NEXT_PUBLIC_V4_HOME=1 build renders MtHome
   straight from app/page.tsx. This gate covers the third: a plain `/` in a tab
   that chose v4 earlier, where the head script in app/layout.tsx keeps
   jg-mtscroll in sessionStorage and sets html[data-mtscroll] (read by
   mtscroll() in lib/v4-home/switch.ts). The server renders the live home
   (`children`); mtscroll.css hides it until this swaps the v4 tree in, so there
   is no flash and no hydration mismatch. The v4 code loads only on this path. */
const MtHome = dynamic(() => import("./home").then((m) => m.MtHome), { ssr: false, loading: () => <i className="mt-wait" hidden /> });
const noop = () => () => {};

export function MtGate({ data, children }: { data: MtData; children: React.ReactNode }) {
  const on = React.useSyncExternalStore(noop, mtscroll, () => false);
  return on ? <MtHome data={data} /> : children;
}
