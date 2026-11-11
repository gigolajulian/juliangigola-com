"use client";

import { cn } from "@/lib/utils";
import { DepositStep } from "@/components/booking/deposit-step";
import { TZ } from "@/lib/booking/booking-rules";
import { Bars, DAYS, Fold, iso, minutesOf, MONTHS, PARTS, recent, WEEKDAYS, WHERE, clock, zone } from "@/components/booking/time-picker-parts";
import type { CardCtx } from "@/components/booking/use-picker";

/* The card before the editorial one, behind `?classic`. */
export function ClassicCard({ c }: { c: CardCtx }) {
  const { title, className, username, slug, tz, here, length, needsWhere, opt, setOpt, ask, setAsk, session, booked, days, view, anchor, pick, arrow, chosen, step, setStep, deposit, smooth, root, error, ok, setOk, load, open, steps, choose, showTimes, week, month, slide, shift, daysBox, mstep, setMstep, switchView, monthGrid, big, gs, slotsW, slotsRef, atStart, book, grow, refill, busy, okMark, swipeProps, t, ap, until, date, sum } = c;
if (step === "pay" && deposit) {
  return (
    <div ref={root} className="contents">
    <DepositStep
      className={className}
      body={deposit}
      rows={[
        ["Session", `${session || title}, ${length} min`],
        ["When", `${sum.replace(" · ", " at ")} ${zone(pick.start, tz)}`],
      ]}
      onBooked={() => {
        recent.delete(`${username}/${slug}/${tz}`);
        setStep("done");
      }}
      onTaken={() => {
        setStep("pick");
        void load(true);
      }}
      onBack={() => setStep("form")}
    />
    </div>
  );
}
if (step === "done") {
  const first = booked.name.split(/\s+/)[0];
  const rows: [string, string][] = [
    ["Session", `${session || title}, ${length} min`],
    ["When", `${sum.replace(" · ", " at ")} ${zone(pick.start, tz)}`],
    ...(booked.where ? ([["Where", booked.where]] as [string, string][]) : []),
    // Only reached through the deposit step once it was paid (Julian).
    ...(deposit ? ([["Deposit", "$100 paid"]] as [string, string][]) : []),
    ["Confirmation", booked.email],
  ];
  const next = ["The confirmation is in your inbox now.", "Need another time? The email has a link to move or cancel it."];
  return (
    <div ref={root} aria-label={title} role="status" data-booked={smooth ? "" : undefined} className={cn("tp !flex min-h-[30rem] flex-col justify-center gap-6 p-6 sm:gap-8 sm:p-10 [&>*]:shrink-0", className)}>
      <div className="flex flex-col gap-4">
        {smooth ? (
          <p className="label flex items-center gap-3 text-foreground">
            <svg viewBox="0 0 112 112" aria-hidden className="tp-status size-7" data-ok="" fill="none">
              <circle className="tp-ring" cx="56" cy="56" r="44" stroke="currentColor" strokeWidth="8" />
              <path className="tp-tick" d="M38 58l12 12 24-26" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Booked
          </p>
        ) : <p className="label tp-roll text-muted-foreground">Booked</p>}
        <h3 className="tp-roll font-display text-[clamp(2.5rem,9.5cqw,5.5rem)] uppercase leading-[0.9] [text-wrap:balance] tracking-[-0.04em]" style={{ animationDelay: "80ms" }}>
          {first ? `${first}, you’re in.` : "You’re in."}
        </h3>
        {/* Julian: say it plainly, under the headline, not as a step. */}
        <p className="tp-roll max-w-[40ch] text-base normal-case leading-relaxed text-foreground/80 text-pretty" style={{ animationDelay: "140ms" }}>
          I&rsquo;ll contact you with the further details before the day.
        </p>
      </div>
      <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        {rows.map(([k, v], n) => (
          <div key={k} className="tp-roll flex min-w-0 flex-col gap-1.5" style={{ animationDelay: `${200 + n * 70}ms` }}>
            <dt className="label text-muted-foreground">{k}</dt>
            <dd className="break-words text-base normal-case leading-snug">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-4 border-t border-border pt-5">
        <p className="label tp-roll text-muted-foreground" style={{ animationDelay: "480ms" }}>What&rsquo;s next</p>
        <ol className="flex flex-col gap-2 text-sm normal-case leading-relaxed text-muted-foreground sm:flex-row sm:gap-10">
        {next.map((t, n) => (
          <li key={t} className="tp-roll flex gap-3 sm:max-w-[16rem]" style={{ animationDelay: `${520 + n * 90}ms` }}>
            <span className="label text-foreground">{`0${n + 1}`}</span>
            {t}
          </li>
        ))}
      </ol>
      </div>
    </div>
  );
}

return (
  <div ref={root} aria-label={title} role="region" data-view={view} data-mstep={mstep} className={cn("tp @container relative !flex min-h-0 flex-col overflow-x-clip p-5 sm:p-10 max-[56rem]:sm:p-6 tp-short:p-5 max-sm:!px-[var(--card-x,1.25rem)]", className)}>
    {busy}
    {/* the days, the time and the ruler fold away once a time is confirmed, so the form fits */}
    <Fold on={step === "pick"} fill>
    {/* the days */}
    <div data-part="days" className="flex flex-col gap-5 tp-short:gap-3">
      <p className="label text-muted-foreground"><span className="mr-3 text-foreground">01</span>Pick a day</p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="label flex items-center gap-2 whitespace-nowrap text-muted-foreground @md:gap-4">
          <button type="button" aria-label="Earlier" onClick={() => shift(-1)} disabled={atStart} className="tap-44 flex h-9 items-center justify-center px-1 text-foreground transition-opacity duration-200 hoverable:hover:opacity-60 disabled:opacity-30">{arrow}</button>
          {/* As wide as the longest it gets, so the arrows hold still. */}
          <span className="grid text-center text-foreground">
            <span aria-hidden className="invisible [grid-area:1/1]">Sep 22 to Sep 28</span>
            <span className="[grid-area:1/1]">{view === "week" ? `${MONTHS[week[0].getMonth()].slice(0, 3)} ${week[0].getDate()} to ${MONTHS[week[6].getMonth()].slice(0, 3)} ${week[6].getDate()}` : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`}</span>
          </span>
          <button type="button" aria-label="Later" onClick={() => shift(1)} className="tap-44 flex h-9 items-center justify-center px-1 text-foreground transition-opacity duration-200 hoverable:hover:opacity-60"><span className="flex rotate-180">{arrow}</span></button>
        </div>
        <div className="label ml-auto flex gap-4">
          {(["week", "month"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => switchView(v)} className={cn("tap-44 border-b pb-1 transition-colors duration-200", view === v ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hoverable:hover:text-foreground")}>
              {v}
            </button>
          ))}
        </div>
      </div>
      {/* Julian: a swipe across the days on a touchscreen goes to the
          next or last week or month, as the arrows do. Sideways only;
          up and down still scroll the page. */}
      <div
        ref={daysBox}
        data-slide={slide}
        className="-m-1 touch-pan-y overflow-hidden p-1"
        {...swipeProps}
      >
      {view === "week" ? (
        <div className="grid grid-cols-7 gap-2 max-sm:-mx-0.5 max-sm:gap-1 sm:gap-2.5">
          {week.map((d) => {
            const id = iso(d);
            const o = open(id);
            const on = pick.date === id;
            return (
              <button
                key={id}
                data-day={id}
                type="button"
                disabled={!o.size}
                aria-pressed={on}
                aria-label={`${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`}
                onClick={(e) => {
                  choose(id, pick.min, false);
                  if (e.currentTarget.closest(".tp[data-split]")) { setMstep("times"); showTimes(); }
                }}
                className={cn(
                  "flex flex-col gap-2 min-w-0 overflow-hidden rounded-[var(--tp-r,6px)] border-[0.5px] p-[var(--pad)] pb-0 text-left [--pad:0.375rem] @md:[--pad:0.625rem] transition-[background-color,color,translate] duration-300 ease-[var(--ease-out-strong)] @xl:[--pad:0.75rem]",
                  on ? "border-foreground bg-foreground text-background" : o.size ? "tp-open hoverable:hover:-translate-y-0.5" : "",
                  // Julian: the square stays round a shut day.
                  !o.size && "pointer-events-none border-border opacity-50",
                )}
              >
                <span className="label opacity-70">{DAYS[d.getDay()]}</span>
                <b className="font-display text-base leading-none @md:text-xl @xl:text-3xl">{d.getDate()}</b>
                {/* Julian: the day's times fill the foot of the tile, edge to
                    edge, round its corners (2026-10-11). */}
                <Bars steps={steps} open={o} on={on} className="-mx-[var(--pad)] mt-auto h-5 @md:h-6" />
              </button>
            );
          })}
        </div>
      ) : (
        <div ref={monthGrid} className="@container grid grid-cols-7 gap-2 sm:gap-2.5">
          {/* The grid is the measure: a tile's number, padding and bars
              follow its width (cqw), so the month beside the times keeps
              the week's proportions rather than cropping them. */}
          {DAYS.map((d) => (
            <span key={d} className="label pb-1 text-muted-foreground">{d[0]}<span className="@max-[22rem]:hidden">{d.slice(1)}</span></span>
          ))}
          {month.map((d, i) => {
            if (!d) return <span key={`b${i}`} />;
            const id = iso(d);
            const o = open(id);
            const on = pick.date === id;
            return (
              <button
                key={id}
                data-day={id}
                type="button"
                disabled={!o.size}
                aria-pressed={on}
                aria-label={`${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`}
                onClick={() => { choose(id, pick.min, false); setMstep("times"); showTimes(); }}
                className={cn(
                  "flex aspect-[1/0.9] max-h-[4.5rem] w-full min-w-0 flex-col justify-between gap-1 overflow-hidden rounded-[var(--tp-r,6px)] border-[0.5px] p-[var(--pad)] pb-0 text-left [--pad:min(0.75rem,1.6cqw,calc(var(--cell-h,99rem)*0.14))] tp-short:aspect-auto transition-[background-color,color,translate] duration-300 ease-[var(--ease-out-strong)] h-[var(--cell-h,auto)]",
                  on ? "border-foreground bg-foreground text-background" : o.size ? "tp-open hoverable:hover:-translate-y-0.5" : "",
                  !o.size && "pointer-events-none border-border opacity-50",
                )}
              >
                {/* The number follows the cell: when a short card squeezes the
                    month (`--cell-h`), it shrinks with it rather than
                    spilling out (Julian, 2026-10-11). */}
                <b className="font-display text-[min(1.875rem,5cqw,calc(var(--cell-h,99rem)*0.42))] leading-none">{d.getDate()}</b>
                <Bars steps={steps} open={o} on={on} className="-mx-[var(--pad)] h-[min(1.25rem,2.8cqw,calc(var(--cell-h,99rem)*0.3))] shrink-0" />
              </button>
            );
          })}
        </div>
      )}
      </div>
    </div>

    {/* the time. Not under a month: the picked button says it, and a
        six-row month on an iPad or a phone had no room for both. */}
    {/* Julian: the big day and time too close to the days and to 02. Spare
        height splits over it and under it, up to 3rem a side. */}
    {view === "week" ? <div aria-hidden className="shrink-0 grow basis-0" style={{ maxHeight: "3rem" }} /> : null}
    {view === "week" ? (
    <div className="flex flex-col gap-0.5 pt-10 sm:pt-[var(--tp-top,2.5rem)] tp-short:pt-3 tp-short:gap-0">
      {/* The day over its time, or what to do before one is picked. */}
      <p key={chosen ? pick.date : "none"} className={cn("tp-roll font-display text-[clamp(1.25rem,4.5cqw,var(--tp-day,2.25rem))] uppercase leading-none tracking-[-0.02em]", !chosen && "text-muted-foreground")}>
        {chosen ? `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}` : "Pick a day, then a time"}
      </p>
      <div className="flex items-baseline gap-3">
      <div ref={big} aria-hidden className={cn("font-display flex tabular-nums tracking-[-0.05em] transition-opacity duration-300 mt-[var(--tp-day-gap,0.15em)] text-[clamp(3.5rem,min(22cqw,14vh),var(--tp-time,9rem))] tp-short:text-[clamp(3rem,10cqw,5rem)] leading-[0.85]", chosen !== "time" && "opacity-25")}>
        {[...t].map((c, i) => (
          <span key={`${i}${c}`} className="tp-roll inline-block">{c}</span>
        ))}
      </div>
      <span className="label">{ap}</span>
      <span className="label ml-auto shrink-0 whitespace-nowrap text-right text-muted-foreground">Until<br />{until} {clock(pick.min + length)[1]}</span>
    </div>
    </div>
    ) : null}

    {/* the gap dial is tuned for the week; a month keeps 1.25rem. Julian:
        "lower". The dial is the least; spare height adds up to 3rem. */}
    {view === "week" ? <div aria-hidden className="shrink-0 grow basis-0" style={{ minHeight: "var(--tp-gap, 2rem)", maxHeight: "calc(var(--tp-gap, 2rem) + 3rem)" }} /> : null}

    {/* the times: the open ones of the day picked, as buttons */}
    <div ref={slotsRef} data-part="times" className={cn("flex flex-col gap-4 pb-6 tp-short:gap-2", view === "month" && "mt-5 tp-short:mt-2")}>
      {/* Back to the month or the week, in the split's times step only (contact.css). */}
      <button type="button" data-part="back" onClick={() => setMstep("days")} className="tap-44 label flex items-center gap-3 self-start text-foreground transition-opacity duration-200 hoverable:hover:opacity-60">
        {arrow}
        {view === "month" ? MONTHS[anchor.getMonth()] : "Week"}
      </button>
      {/* A month too tall to share (January, six weeks): its times alone
          left a hole over them, so the day and time picked fill it, big,
          as under the week (Julian, 2026-10-16). Shown in that step only
          (contact.css). */}
      {view === "month" ? (
        <div data-part="big" aria-hidden className="flex flex-1 flex-col justify-center gap-0.5">
          <p className="font-display text-[clamp(1.25rem,4.5cqw,2.25rem)] uppercase leading-none tracking-[-0.02em]">{`${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`}</p>
          <div className="flex items-baseline gap-3">
            <span className={cn("font-display tabular-nums tracking-[-0.05em] mt-[0.15em] text-[clamp(3rem,min(18cqw,12vh),7rem)] leading-[0.85] transition-opacity duration-300", chosen !== "time" && "opacity-25")}>{t}</span>
            <span className="label">{ap}</span>
            <span className="label ml-auto shrink-0 whitespace-nowrap text-right text-muted-foreground">Until<br />{until} {clock(pick.min + length)[1]}</span>
          </div>
        </div>
      ) : null}
      <p className="label text-muted-foreground"><span className="mr-3 text-foreground">02</span>Pick a time
        {/* Under a month there is no day over the times to say whose they
            are, and the month shown may not hold it (Julian). */}
        {view === "month" ? <span className="ml-3 text-foreground">{WEEKDAYS[date.getDay()].slice(0, 3)}, {MONTHS[date.getMonth()].slice(0, 3)} {date.getDate()}</span> : null}
      </p>
      {/* Julian: the times in kinds, morning, afternoon and evening, side
          by side on one line the width of the picker, each named over its
          own and as wide as its share of the times. No AM or PM in the
          boxes: the kind says it. When a box would be under 4.25rem (a day
          of half hours, a phone), a kind to a line, named to its left past a
          phone, the boxes on one grid so they line up from kind to kind. */}
      {(() => {
      const timesFor = (date: string) => {
      const kinds = PARTS.map(([part, from, to]) => [part, (days[date] ?? []).filter((x) => minutesOf(x.start) >= from && minutesOf(x.start) < to)] as const).filter(([, list]) => list.length);
      const n = kinds.reduce((t, [, list]) => t + list.length, 0);
      const line = n * 68 + (n - kinds.length) * 6 + (kinds.length - 1) * 24 <= slotsW;
      /* Stacked, the rows are even: ten afternoon times went seven and
         an orphaned three. As many columns as fit at 5rem, then fewer,
         so the longest kind splits evenly (five and five), and every
         kind shares them so the boxes line up. Past a phone the names
         take 6.5rem and a 1rem gap at the left (the @md rail). */
      const room = slotsW >= 448 ? slotsW - 120 : slotsW;
      const most = Math.max(1, ...kinds.map(([, list]) => list.length));
      const fit = Math.max(1, Math.floor((room + 6) / (slotsW >= 448 ? 76 : 86)));
      const cols = Math.min(fit, Math.ceil(most / Math.ceil(most / fit)));
      return (
      <div key={date} className={cn("flex gap-x-6 gap-y-3 tp-short:gap-y-3", !line && "flex-col")}>
      {kinds.map(([part, list]) => (
        <div key={part} className={cn("flex min-w-0 flex-col gap-2 tp-short:gap-1", line ? "basis-0" : "@md:grid @md:grid-cols-[6.5rem_minmax(0,1fr)] @md:items-baseline @md:gap-x-4")} style={line ? { flexGrow: list.length } : undefined}>
        <span className="label text-muted-foreground">{part}</span>
        <div className={line ? "flex gap-1.5" : "grid gap-1.5"} style={line ? undefined : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {list.map((x) => {
          const n = (days[date] ?? []).indexOf(x);
          const m = minutesOf(x.start);
          const on = chosen === "time" && m === pick.min;
          const [h, a] = clock(m);
          return (
            <button
              key={x.start}
              data-slot=""
              type="button"
              aria-pressed={on}
              aria-label={`${h} ${a}`}
              onClick={() => choose(date, m, true)}
              style={gs ? undefined : { animationDelay: `${n * 25}ms` }}
              className={cn(
                !gs && "tp-rise",
                "label min-w-0 flex-1 rounded-[var(--tp-r,6px)] [animation-fill-mode:backwards] border-[0.5px] py-[min(var(--tp-slot,0.75rem),0.625rem)] text-center sm:py-[var(--tp-slot,0.75rem)] tabular-nums transition-[background-color,color,translate] duration-300 ease-[var(--ease-out-strong)] tp-short:py-2",
                on ? "border-foreground bg-foreground text-background" : "tp-open hoverable:hover:-translate-y-0.5",
                // A day of one or two times: a box, not a bar the width of
                // the card.
                line && "max-w-[9rem]",
                // A crowded day: shorter boxes, or the evening fell under
                // the bar (an iPad held sideways; a week of half-hour calls
                // at 1547x889).
                !line && "py-2 sm:py-2 tp-short:py-1.5",
              )}
            >
              {h}
            </button>
          );
        })}
        </div>
        </div>
      ))}
      </div>
      );
      };
      /* Julian: on a phone the day's times in the phone's own wheel,
         one line, so the card keeps its length from day to day and the
         wall behind it holds still (the buttons are off there). */
      const list = days[pick.date] ?? [];
      return (
        <>
          <div className="max-sm:hidden">{timesFor(pick.date)}</div>
          <label className="relative sm:hidden">
            <span className="sr-only">Time</span>
            <select
              data-part="wheel"
              value={chosen === "time" ? String(pick.min) : ""}
              onChange={(e) => e.target.value && choose(pick.date, Number(e.target.value), true)}
              className="label w-full appearance-none rounded-[var(--tp-r,6px)] border-[0.5px] border-foreground/40 bg-transparent py-3.5 pl-4 pr-10 text-foreground"
            >
              <option value="" disabled>{`Choose a time · ${list.length} open`}</option>
              {list.map((x) => {
                const m = minutesOf(x.start);
                const [h, a] = clock(m);
                return <option key={x.start} value={m}>{`${h} ${a}`}</option>;
              })}
            </select>
            <svg aria-hidden viewBox="0 0 12 8" className="pointer-events-none absolute right-4 top-1/2 w-3 -translate-y-1/2 text-foreground" fill="none"><path d="M1 1.5l5 5 5-5" stroke="currentColor" strokeWidth="1.2" /></svg>
          </label>
        </>
      );
      })()}
    </div>
    </Fold>

    {/* confirm */}
    {step === "pick" ? (
      <div className="sticky bottom-0 z-10 mt-auto flex flex-col gap-4 pt-6 bg-background/80 backdrop-blur-md tp-short:pb-1 tp-short:pt-4 @md:flex-row @md:items-center @md:justify-between">
        <span className="label text-muted-foreground">{chosen === "time" ? `${sum} ${zone(pick.start, tz)}` : `San Jose, CA · ${here}${tz === TZ ? "" : ` · times in ${zone(pick.start, tz)}`}`}</span>
        <button type="button" data-part="act" onClick={() => setOk("spin")} disabled={chosen !== "time"} aria-busy={!!ok} className="label relative rounded-[2px] border border-foreground bg-foreground px-6 @max-md:w-full py-4 text-background transition-[opacity,scale,background-color,border-color,color] duration-300 enabled:border-accent enabled:bg-accent enabled:text-accent-foreground hoverable:hover:opacity-85 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35">
          <span className={cn("transition-opacity duration-200", ok && "opacity-0")}>Confirm this time</span>
          {okMark}
        </button>
      </div>
    ) : (
      <form
        ref={refill}
        onSubmit={(e) => {
          e.preventDefault();
          void book(new FormData(e.currentTarget));
        }}
        className="tp-rise flex flex-col gap-4"
      >
        <div data-part="when" className="flex items-center justify-between gap-4">
          <span className="label">{sum}</span>
          <button type="button" onClick={() => setStep("pick")} className="label text-muted-foreground hoverable:hover:text-foreground">Change</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label flex flex-col gap-2 text-muted-foreground">First name *<input name="first" required autoComplete="given-name" className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
          <label className="label flex flex-col gap-2 text-muted-foreground">Last name *<input name="last" required autoComplete="family-name" className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
          <label className="label flex flex-col gap-2 text-muted-foreground">Email *<input name="email" type="email" required autoComplete="email" className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
          <label className="label flex flex-col gap-2 text-muted-foreground">Phone *<input name="phone" type="tel" required autoComplete="tel" inputMode="tel" className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
          {needsWhere && WHERE[slug]?.length === 1 ? null : needsWhere && WHERE[slug] ? (
            <>
              <fieldset className="flex flex-col sm:col-span-2">
                <legend className="label mb-2 text-muted-foreground">Location *</legend>
                <div className="flex flex-wrap gap-2">
                  {WHERE[slug].map(([label]) => (
                    <label key={label} className="label cursor-pointer">
                      <input type="radio" name="opt" value={label} required checked={opt === label} onChange={() => {
                        setOpt(label);
                        const next = WHERE[slug].find(([l]) => l === label)?.[1];
                        if (next) setAsk(next);
                      }} className="peer sr-only" />
                      <span data-part="chip" className="block rounded-[2px] border border-border px-5 py-3 transition-colors duration-200 hoverable:hover:border-foreground peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2">{label}</span>
                    </label>
                  ))}
                </div>
                <Fold on={!!WHERE[slug].find(([label]) => label === opt)?.[1]}>
                  <label className="label flex flex-col gap-2 pt-4 text-muted-foreground">{ask}<input name="detail" required={!!WHERE[slug].find(([label]) => label === opt)?.[1]} className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
                </Fold>
              </fieldset>
            </>
          ) : needsWhere ? (
            <label className="label flex flex-col gap-2 text-muted-foreground sm:col-span-2">Where: the studio, or an address?<input name="where" required className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
          ) : null}
        </div>
        
        <label className="label flex flex-col gap-2 text-muted-foreground">Anything I should know<textarea name="notes" rows={2} autoComplete="off" onInput={grow} placeholder="Optional" className="tp-notes resize-none placeholder:uppercase placeholder:text-muted-foreground border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
        {error ? <p role="alert" className="text-sm normal-case text-foreground">{error}</p> : null}
        <button type="submit" data-part="act" data-stick="fill" disabled={step === "sending"} className="label self-end rounded-[2px] border border-foreground bg-foreground px-6 py-4 text-background transition-[opacity,scale] duration-300 hoverable:hover:opacity-85 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50">
          {step === "sending" ? "Booking" : "Book it"}
        </button>
      </form>
    )}
  </div>
);
}
