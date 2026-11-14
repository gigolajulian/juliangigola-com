"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { mtscroll } from "@/lib/mtscroll";
import type { MtData } from "./data";

/* `?mtscroll=1` picks the v4 home on the client. The server always renders
   the live home (`children`); with the flag, mtscroll.css hides it until this
   swaps the v4 tree in, so there is no flash and no hydration mismatch. The
   v4 code loads only with the flag. */
const MtHome = dynamic(() => import("./home").then((m) => m.MtHome), { ssr: false });
const noop = () => () => {};

export function MtGate({ data, children }: { data: MtData; children: React.ReactNode }) {
  const on = React.useSyncExternalStore(noop, mtscroll, () => false);
  return on ? <MtHome data={data} /> : children;
}
