import * as React from "react";
import { clockLabel } from "@/components/booking/flow";
import { clock, minutesOf } from "@/components/booking/time-picker-parts";
import { PARTS, pacific, partOf, sunHint, tone } from "@/lib/booking/sky";
import { useSkyTimesIn } from "@/components/booking/sky-motion";

/* The day's open times in the hour's light (?sky, lib/booking/sky.ts), in place of the swipe strip.
   Week view: one time per row, where it sits against the sun on the right. Month view: a ruler, the
   times on one lit track with Morning, Afternoon, Evening under it. Each time keeps `data-slot`,
   aria-pressed and its spoken label, as the strip had them. */
export function SkyTimes({ times, picked, length, ruler: month, choose }: { times: string[]; picked: number; length: number; ruler: boolean; choose: (min: number) => void }) {
  /* Grouped by the light in San Jose, where the shoot is, as the colors are; a visitor on another clock is told so. */
  const pt = (x: string) => partOf(Math.round(pacific(Date.parse(x)).hour * 60));
  const away = times.some((x) => Math.round(pacific(Date.parse(x)).hour * 60) !== minutesOf(x));
  const groups = PARTS.map((p, k) => ({ name: away ? `${p.name} in San Jose` : p.name, list: times.filter((x) => pt(x) === k) })).filter((g) => g.list.length);
  // past a dozen times (the 30 minute calls) a ruler's columns get too narrow to read or tap: rows instead
  const ruler = month && times.length <= 12;
  const box = React.useRef<HTMLDivElement>(null);
  useSkyTimesIn(box, times[0]?.slice(0, 10) ?? "");
  const slot = (x: string, i: number) => {
    const m = minutesOf(x), ms = Date.parse(x), t = tone(ms);
    const [h, a] = clock(m);
    return (
      <button
        key={x}
        type="button"
        data-slot=""
        aria-pressed={m === picked}
        aria-label={clockLabel(m)}
        className={m > picked && m < picked + length ? "in" : undefined}
        style={{ "--tc": t.dark, "--tcl": t.light, "--i": i } as React.CSSProperties}
        onClick={() => choose(m)}
      >
        <i aria-hidden="true" />
        <b>{ruler ? h.replace(":00", "") : h}</b>
        <small>{a}</small>
        {ruler ? null : <span className="hint">{sunHint(ms)}</span>}
      </button>
    );
  };
  if (ruler) {
    return (
      <div ref={box} className="sky-ruler lbl" style={{ "--n": times.length } as React.CSSProperties}>
        {times.map(slot)}
        {groups.map((g) => <span key={g.name} className="rl" style={{ gridColumn: `span ${g.list.length}` }}>{g.name}</span>)}
      </div>
    );
  }
  let i = 0;
  return (
    <div ref={box} className="sky-rows lbl">
      {groups.map((g) => (
        <div key={g.name} role="group" aria-label={g.name}>
          <p className="grp mute">{g.name}</p>
          {g.list.map((x) => slot(x, i++))}
        </div>
      ))}
    </div>
  );
}
