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
  /* The white line rides the beam's own lap: its angle is a property
     named after the beam's id (`data-beam`), so read it off the card. */
  const edge = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = edge.current;
    const id = el?.parentElement?.dataset.beam;
    if (el && id) el.style.setProperty("--edge-a", `var(--beam-angle-${id})`);
  }, []);
  return (
    <BorderBeam
      size="md"
      colorVariant="mono"
      /* Julian (2026-10-03): brighter. Full strength (was 0.7) and the
         glow lifted past the library's 1.3. */
      strength={1}
      /* Julian (2026-10-05): a white line and its glow that go round the
         form, never sitting still: the beam is the whole effect, wider
         and brighter (a static line and halo on the card were tried and
         taken off). */
      brightness={3}
      glowSize={2.2}
      theme={theme}
      /* Julian: rounded, 16px, with the form's box (`rounded-[16px]`,
         `app/contact/page.tsx`). */
      borderRadius={16}
      /* Julian: slower. A lap in six seconds (four until 2026-10-05),
         against the default 1.96. */
      duration={6}
      className={className}
    >
      <span ref={edge} aria-hidden className="contact-edge" />
      {children}
    </BorderBeam>
  );
}
