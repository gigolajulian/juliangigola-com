"use client";

import * as React from "react";
import { BorderBeam } from "border-beam";
import { useSiteTheme } from "@/lib/site-theme";

/* Julian: the form in a beam (`border-beam`, Libraries.dev), at his
   settings: the full border, in the site's own theme. Mono: Julian
   took the colors off the form (2026-09-29). */
export function ContactBeam({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const theme = useSiteTheme();
  return (
    <BorderBeam
      size="md"
      colorVariant="mono"
      /* Julian (2026-10-03): brighter. Full strength (was 0.7) and the
         glow lifted past the library's 1.3. */
      strength={1}
      brightness={2}
      theme={theme}
      /* Julian: rounded, 16px, with the form's box (`rounded-[16px]`,
         `app/contact/page.tsx`). */
      borderRadius={16}
      /* Julian: slower. A lap in four seconds, against the default 1.96. */
      duration={4}
      className={className}
    >
      {children}
    </BorderBeam>
  );
}
