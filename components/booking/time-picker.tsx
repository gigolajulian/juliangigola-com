"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Orb } from "@/components/orb";
import { clock, DAYS, fromIso, MONTHS, type V3Book } from "@/components/booking/time-picker-parts";
import { usePicker, type CardCtx, type Props } from "@/components/booking/use-picker";
import { V3Steps } from "@/components/booking/time-picker-v3";
import { EditorialCard } from "@/components/booking/time-picker-editorial";
import { ClassicCard } from "@/components/booking/time-picker-classic";

export type { V3Book };

export function TimePicker(props: Props) {
  const c = usePicker(props);
  const { title, className, fallback, v3, length, days, state, held, orb, jg, pick, editorial, heldBar, v3plain } = c;
  if (state === "fallback") return v3 ? v3plain(fallback) : <>{fallback}</>;
  const waiting = <p role="status" className="lbl mute">Loading availability</p>;
  if (v3 && (state === "loading" || !days || (held && !orb))) return v3plain(orb ? waiting : jg, heldBar);
  if (v3 && !pick) return Object.values(days ?? {}).some((l) => l.length) ? v3plain(waiting, heldBar) : v3plain(<p className="lbl mute">No open times in the next few months. <a href="mailto:hello@juliangigola.com">hello@juliangigola.com</a></p>);
  if (state === "loading" || !days || (held && state === "ready" && !v3)) {
    return (
      // Held to the card's inset and a phone card's height while it waits
      // (the embed's `block` had it on the card's edge, in a sliver).
      <div aria-label={title} className={cn(className, "!flex items-center justify-center px-[var(--card-x,1.25rem)] max-sm:min-h-[24rem]")}>
        {/* Julian: an orb turning, not the words (composing since 2026-10-20; working was picked from
            orb-options 2026-10-14; 64px, at 20 it was lost in the empty card). Still
            said to a reader. */}
        {/* In the middle of the card, not of the room under its top line
            (QA on #143, Julian: the orb in the center of the card): lifted
            half that line (`--card-lift`, book-here.tsx). */}
        {/* Julian (2026-10-14): what it is waiting for, under the orb. */}
        {orb ? (
          <p role="status" className="pointer-events-none absolute inset-0 flex -translate-y-[var(--card-lift,0px)] flex-col items-center justify-center gap-4 text-muted-foreground">
            <Orb state="composing" size={64} />
            <span className="label animate-[jg-fade-in_300ms_ease-out_300ms_both]">Loading availability</span>
          </p>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex -translate-y-[var(--card-lift,0px)] items-center justify-center">{jg}</div>
        )}
      </div>
    );
  }
  if (!pick) {
    return (
      <div aria-label={title} className={cn("flex flex-col items-center justify-center gap-4 p-6 text-center", className)}>
        <p className="label text-muted-foreground">No open times in the next few months.</p>
        <a href="mailto:hello@juliangigola.com" className="label border-b border-border">hello@juliangigola.com</a>
      </div>
    );
  }

  const [t, ap] = clock(pick.min);
  const [until] = clock(pick.min + length);
  const date = fromIso(pick.date);
  const sum = `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} · ${t} ${ap}`;

  const ctx: CardCtx = { ...c, pick, days, t, ap, until, date, sum, waiting };
  /* ── JG V3 (master v39 stepper): Time, You, (Deposit), Booked. The same
     times, booking and deposit as the cards below; only the look is new. */
  if (v3 && editorial) return <V3Steps c={{ ...ctx, v3 }} />;
  if (editorial) return <EditorialCard c={ctx} />;
  return <ClassicCard c={ctx} />;
}
