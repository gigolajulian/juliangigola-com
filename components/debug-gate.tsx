"use client";

import * as React from "react";

/* ── the debug gate ───────────────────────────────────────────────
 * Mounts `debug-overlay.tsx` when the address has `?debug`, and nothing
 * otherwise. The overlay is fetched with a plain `import()` once the
 * param has been seen, so a visit without it never requests the chunk.
 * Read once on mount: the layout stays mounted across navigations, so the
 * overlay stays with it until a full reload without the param.
 * ─────────────────────────────────────────────────────────────── */

export function DebugGate() {
  const [Overlay, setOverlay] = React.useState<React.ComponentType | null>(null);

  React.useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    let live = true;
    import("./debug-overlay").then((m) => {
      if (live) setOverlay(() => m.DebugOverlay);
    });
    return () => {
      live = false;
    };
  }, []);

  return Overlay ? <Overlay /> : null;
}
