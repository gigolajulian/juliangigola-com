"use client";

import * as React from "react";
import { BorderBeam } from "border-beam";
import { useSiteTheme } from "@/lib/site-theme";

/* Julian: the form in a beam (`border-beam`, Libraries.dev), at his
   settings: the full border, in the site's own theme. Mono: Julian
   took the colors off the form (2026-09-29). */
/** A lap, in seconds, and how many it gets before it rests. */
const LAP = 6;
const LAPS = 2;
/* Held where it stands, every layer, so the line and its glow stay put
   rather than fading. A held animation is not repainted. */
const REST = `
[data-beam="{id}"][data-rest],
[data-beam="{id}"][data-rest]::before,
[data-beam="{id}"][data-rest]::after,
[data-beam="{id}"][data-rest] [data-beam-bloom] {
  animation-play-state: paused !important;
}`;

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
  /* Two laps and then rest (Julian, 2026-10-08), on every screen. The
     glow is repainted every frame it moves: on an iPad held still on
     Inquiries it was a third of the frame rate (38fps running, 60 held),
     and on a 1920 wide window it took Inquiries from 12fps to 4. So it
     runs two laps each time the card comes into view, stops where it
     stands, and goes round again under a pointer, a touch or a field
     taking focus. */
  React.useEffect(() => {
    const card = edge.current?.parentElement;
    if (!card) return;
    let rest = 0;
    const run = () => {
      card.removeAttribute("data-rest");
      clearTimeout(rest);
      rest = window.setTimeout(() => {
        card.setAttribute("data-rest", "");
      }, LAPS * LAP * 1000);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) run();
        else clearTimeout(rest);
      },
      { threshold: 0.5 },
    );
    io.observe(card);
    // And from the start, so it comes to rest even if the observer never
    // reports.
    run();
    card.addEventListener("pointerdown", run, { passive: true });
    card.addEventListener("pointerenter", run, { passive: true });
    card.addEventListener("focusin", run);
    return () => {
      io.disconnect();
      clearTimeout(rest);
      card.removeEventListener("pointerdown", run);
      card.removeEventListener("pointerenter", run);
      card.removeEventListener("focusin", run);
    };
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
         against the default 1.96 (`LAP`). */
      duration={LAP}
      css={REST}
      className={className}
    >
      <span ref={edge} aria-hidden className="contact-edge" />
      {children}
    </BorderBeam>
  );
}
