"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { mtscroll } from "@/lib/v4-home/switch";
import type { HomeData } from "@/lib/v4-home/data";
import { noSubscribe } from "@/lib/utils";

/* Three ways to the v4 home. `/?mtscroll=1` is rewritten on the server to
   app/home-v4 (next.config.ts). A NEXT_PUBLIC_V4_HOME=1 build renders Home
   straight from app/page.tsx. This gate covers the third: a plain `/` in a tab
   that chose v4 earlier, where the head script in app/layout.tsx keeps
   jg-mtscroll in sessionStorage and sets html[data-mtscroll] (read by
   mtscroll() in lib/v4-home/switch.ts). The server renders the live home
   (`children`); mtscroll.css hides it until this swaps the v4 tree in, so there
   is no flash and no hydration mismatch. The v4 code loads only on this path. */
const Home = dynamic(() => import("./home").then((m) => m.Home), { ssr: false, loading: () => <i className="mt-wait" hidden /> });

export function HomeGate({ data, children }: { data: HomeData; children: React.ReactNode }) {
  const on = React.useSyncExternalStore(noSubscribe, mtscroll, () => false);
  return on ? <Home data={data} /> : children;
}
