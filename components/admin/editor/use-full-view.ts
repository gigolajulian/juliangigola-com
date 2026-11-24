import * as React from "react";

/** A workbench column the editor can take full screen. */
export type FullView = "map" | "work" | "preview";

/* One column over the whole workbench, the other two out of the way
   (`editor.tsx`): Julian wanted each one full screen, to see it from above.
   Escape brings the three back. */
export function useFullView() {
  const [full, setFull] = React.useState<FullView | null>(null);
  React.useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  return [full, setFull] as const;
}
