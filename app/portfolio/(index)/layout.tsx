import type * as React from "react";

/**
 * The work index's layout. /portfolio and /portfolio/video draw their own
 * V3 head, and every discipline page 308s to /portfolio?d=<slug>
 * (next.config.ts, disciplineRedirects), so the old `WorkShell` frame was
 * built here but never shown, and still shipped its client code and props
 * with every /portfolio visit (audit 2026-11-09, N2). `components/work-shell.tsx`
 * and `components/v3/index-frame.tsx` stay in the tree, unused.
 */
export default function WorkIndexLayout({ children }: { children: React.ReactNode }) {
  return children;
}
