"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { clock, DAYS, fromIso, MONTHS, type StepsSkin } from "@/components/booking/time-picker-parts";
import { usePicker, type CardCtx, type Props } from "@/components/booking/use-picker";
import { BookSteps } from "@/components/booking/time-picker-steps";
import { EditorialCard } from "@/components/booking/time-picker-editorial";
import { JgLoad } from "@/components/splash/jg-load";

export type { StepsSkin };

export function TimePicker(props: Props) {
  const c = usePicker(props);
  const { fallback } = props;
  const { title, className, skin, length, days, state, held, unhold, pick, v3paid, v3steps, v3sub } = c;
  /* J and G fill while the times load (jg-load.tsx) and let go of the picker themselves. */
  const jg = <JgLoad done={state === "ready" && !!days} onDone={unhold} className="f-wait min-h-[16rem] w-full" />;
  /* While the times load the bar is already there, held off: it popped in
     a second after the page on a short screen, where it is the thing at the
     foot of the view (MAC, iPhone Duo folded, 2026-11-08). */
  const heldBar = <button type="button" className="btn fill" disabled>Continue</button>;
  // in the div `BookSteps` puts the shell in, so the shell stays one element as the times come
  const v3plain = (body: React.ReactNode, bar?: React.ReactNode) => <div className="contents">{skin!.shell({ steps: v3steps, at: 1, head: v3paid ? "Book a session" : skin!.name === "Consultation" ? "Book a consultation" : "Book a call", sub: v3sub, body, sum: [], bar })}</div>;
  /* It reads the visitor's zone and clock: until it has mounted, the empty box
     under a held Continue (from the first paint), drawn here and not by
     `BookTimes`, so the shell is never swapped for another and remounted. */
  const [mounted, setMounted] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);
  // the same shell the held picker draws (steps, sub, J and G), so nothing moves when it mounts (CLS 0.107 at 1440, audit 2026-11-21)
  if (!mounted) return skin ? v3plain(jg, heldBar) : <div aria-label={title} className={className} />;
  if (state === "fallback") return skin ? v3plain(fallback) : <>{fallback}</>;
  const waiting = <p role="status" className="lbl mute">Loading availability</p>;
  if (skin && (state === "loading" || !days || held)) return v3plain(jg, heldBar);
  if (skin && !pick) return Object.values(days ?? {}).some((l) => l.length) ? v3plain(waiting, heldBar) : v3plain(<p className="lbl mute">No open times in the next few months. <a href="mailto:hello@juliangigola.com">hello@juliangigola.com</a></p>);
  if (state === "loading" || !days || (held && state === "ready" && !skin)) {
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

  const ctx: CardCtx = { ...c, pick, days, t, ap, until, date, sum };
  /* ── The V3 stepper: Time, You, (Deposit), Booked. The same
     times, booking and deposit as the cards below; only the look is new. */
  /* Called, not mounted: as an element it was a new component in the shell's
     place, and the shell remounted when the first time came. It has no hooks. */
  if (skin) return BookSteps({ c: { ...ctx, skin } });
  return <EditorialCard c={ctx} />;
}
