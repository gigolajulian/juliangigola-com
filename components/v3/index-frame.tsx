"use client";

import type * as React from "react";
import { usePathname } from "next/navigation";

/* /portfolio and /portfolio/video are V3 screens and draw their own head; the discipline and
   video pages under the same layout keep the work shell. */
export function IndexFrame({ shell, children }: { shell: React.ReactNode; children: React.ReactNode }) {
  return <>{/^\/portfolio(\/video)?$/.test(usePathname()) ? children : shell}</>;
}
