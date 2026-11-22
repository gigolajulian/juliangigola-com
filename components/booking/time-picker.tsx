"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { clock, DAYS, fromIso, MONTHS, type V3Book } from "@/components/booking/time-picker-parts";
import { usePicker, type CardCtx, type Props } from "@/components/booking/use-picker";
import { V3Steps } from "@/components/booking/time-picker-v3";
import { EditorialCard } from "@/components/booking/time-picker-editorial";
import { isPaid } from "@/lib/booking/paid";

export type { V3Book };

export function TimePicker(props: Props) {
  const c = usePicker(props);
  const { title, className, fallback, v3, length, days, state, held, jg, pick, heldBar, v3plain, slug } = c;
  /* It reads the visitor's zone and clock: until it has mounted, the empty box
     under a held Continue (from the first paint), drawn here and not by
     `BookTimes`, so the shell is never swapped for another and remounted. */
  const [mounted, setMounted] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    const box = <div aria-label={title} className={className} />;
    if (!v3) return box;
    const head = isPaid(slug) ? "Book a session" : v3.name === "Consultation" ? "Book a consultation" : "Book a call";
    return <div className="contents">{v3.shell({ steps: [], at: 1, head, body: box, sum: [], bar: heldBar })}</div>;
  }
  if (state === "fallback") return v3 ? v3plain(fallback) : <>{fallback}</>;
  const waiting = <p role="status" className="lbl mute">Loading availability</p>;
  if (v3 && (state === "loading" || !days || held)) return v3plain(jg, heldBar);
  if (v3 && !pick) return Object.values(days ?? {}).some((l) => l.length) ? v3plain(waiting, heldBar) : v3plain(<p className="lbl mute">No open times in the next few months. <a href="mailto:hello@juliangigola.com">hello@juliangigola.com</a></p>);
  if (state === "loading" || !days || (held && state === "ready" && !v3)) {
    return (
      // Held to the card's inset and a phone card's height while it waits
      // (the embed's `block` had it on the card's edge, in a sliver).
      <div aria-label={title} className={cn(className, "!flex items-center justify-center px-[var(--card-x,1.25rem)] max-sm:min-h-[24rem]")}>
        <div className="pointer-events-none absolute inset-0 flex -translate-y-[var(--card-lift,0px)] items-center justify-center">{jg}</div>
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
  /* Called, not mounted: as an element it was a new component in the shell's
     place, and the shell remounted when the first time came. It has no hooks. */
  if (v3) return V3Steps({ c: { ...ctx, v3 } });
  return <EditorialCard c={ctx} />;
}
