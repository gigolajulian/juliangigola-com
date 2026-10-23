"use client";

import type * as React from "react";
import { usePathname } from "next/navigation";

/* /portfolio is the V3 screen and draws its own head; the discipline and
   video pages under the same layout keep the work shell. */
export function IndexFrame({ shell, children }: { shell: React.ReactNode; children: React.ReactNode }) {
  return <>{usePathname() === "/portfolio" ? children : shell}</>;
}
