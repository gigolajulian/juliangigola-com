"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DepositStep } from "@/components/booking/deposit-step";
import { goo } from "@/components/booking/deposit-step";
import { TZ } from "@/lib/booking/booking-rules";
import { AHEAD, DAYS, iso, minutesOf, MONTHS, forgetTimes, STEP_AT, WEEKDAYS, WHERE, clock, zone } from "@/components/booking/time-picker-parts";
import type { CardCtx } from "@/components/booking/use-picker";

/* The card as a magazine page (editorial.css), the default since 2026-10-17. */
export function EditorialCard({ c }: { c: CardCtx }) {
  const { title, className, username, slug, tz, here, length, needsWhere, opt, setOpt, via, setVia, ask, setAsk, session, booked, days, view, anchor, pick, arrow, chosen, step, setStep, paid, deposit, root, error, ok, setOk, load, open, choose, showTimes, today, week, month, shift, daysBox, mstep, setMstep, switchView, slotsW, slotsRef, atStart, book, grow, refill, busy, okMark, swipeProps, t, ap, until, date, sum } = c;
  const d3 = (d: Date) => DAYS[d.getDay()][0] + DAYS[d.getDay()].slice(1).toLowerCase();
  const mon = (d: Date) => MONTHS[d.getMonth()].slice(0, 3);
  const [, apEnd] = clock(pick.min + length);
  const tzName = zone(pick.start, tz);
  const range = `${d3(date)} ${date.getDate()} ${mon(date)}, ${t}${ap === apEnd ? "" : ` ${ap}`} to ${until} ${apEnd} ${tzName}`;
  const at = step === "done" ? -1 : STEP_AT[step];
  /* A call (no deposit): a handset, its length in minutes (Julian, 2026-10-17: "15:00" read as 3 PM). */
  const call = !paid;
  const handset = (
    <svg aria-hidden viewBox="0 0 24 24" className="ed-handset" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M5 3h3.5l1.5 4.5-2.25 1.5a11 11 0 0 0 5.25 5.25l1.5-2.25L19 13.5V17a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />
    </svg>
  );
  const camera = (
    <svg aria-hidden viewBox="0 0 24 24" className="ed-handset" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <rect x="2.5" y="6" width="13" height="12" rx="1.5" />
      <path d="M15.5 10.5 21.5 7v10l-6-3.5z" />
    </svg>
  );
  const timer = length >= 60 ? `${Math.floor(length / 60)} hr${length % 60 ? ` ${length % 60} min` : ""}` : `${length} min`;
  const tel = (n: string) => (/^\+1\d{10}$/.test(n) ? `(${n.slice(2, 5)}) ${n.slice(5, 8)} ${n.slice(8)}` : n);
  const bar = (
    <nav aria-label="Steps" className="ed-steps label">
      {call ? <span className="ed-call">{step !== "pick" && (booked.via || via) === "Video" ? camera : handset}{step === "pick" ? "Call" : `${step === "done" ? booked.via || via : via} call`} · {timer}</span> : null}
      {(paid ? ["Date", "Details", "Deposit"] : ["Date", "Details"]).map((s, i) => {
        const back = at > i ? () => setStep(i ? "form" : "pick") : undefined;
        return (
          <button key={s} type="button" disabled={!back} onClick={back} aria-current={at === i ? "step" : undefined} data-done={at > i || at < 0 ? "" : undefined}>
            <b>{`0${i + 1}`}</b>
            {s}
          </button>
        );
      })}
    </nav>
  );
  /* One face, two sizes (Julian, 2026-10-20, from the Tenebra reference):
     each step opens on one huge line, small caps beside and under it. */
  const what = `${session || title} · ${timer}`;
  const dayLine = `${d3(date)} ${date.getDate()} ${mon(date)} · ${t} ${ap}`;
  const hero = (big: React.ReactNode, side: React.ReactNode, mark: React.ReactNode, act?: React.ReactNode) => (
    <div className="ed-hero">
      <h2>{big}<small>{side}</small></h2>
      <p className="ed-mk"><i />{mark}{act}</p>
    </div>
  );
  if (step === "pay" && deposit) {
    return (
      <div ref={root} className="contents">
        <DepositStep
          editorial
          head={<>{bar}{hero("$100", `Deposit. Holds ${dayLine}`, "Balance due after the shoot", <button type="button" data-stick={goo() ? "fill" : undefined} className="ed-box" onClick={() => setStep("form")}>Change</button>)}</>}
          className={className}
          body={deposit}
          rows={[
            ["Session", `${session || title}, ${length} min`],
            ["When", range],
          ]}
          onBooked={() => {
            forgetTimes(username, slug, tz);
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
    const ring = call && booked.via === "Phone";
    const rows: [string, string][] = [
      ["When", range],
      ...(call && booked.via ? ([["Call", ring ? `Phone call, ${length} min` : `Video call on Google Meet, ${length} min`]] as [string, string][]) : []),
      ...(ring ? ([["Number", tel(booked.phone)]] as [string, string][]) : []),
      ...(booked.where ? ([["Where", booked.where]] as [string, string][]) : []),
      ...(deposit ? ([["Deposit", "$100 paid"]] as [string, string][]) : []),
      ["Sent to", booked.email],
    ];
    return (
      <div ref={root} aria-label={title} role="status" data-booked="" className={cn("tp ed", className)}>
        {bar}
        {/* The check (or the handset, the camera) on the Booked line, in
            the square's place; the message a sentence over the rows
            (Julian, 2026-10-21: the check in a better spot, the text
            beautified). */}
        {hero(<>You&rsquo;re in</>, <>{dayLine}<br />{what}</>, <>{call && booked.via ? (booked.via === "Video" ? camera : handset) : <svg aria-hidden viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="11" cy="11" r="10" /><path d="M6.5 11.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}{call && booked.via ? `${booked.via} call booked` : "Booked"}</>)}
        <div className="ed-body">
          <div className="ed-l ed-ok">
            {call && booked.via ? (
              /* Julian: a call reads as a call, the number I ring. */
              <p className="ed-why">{first ? `${first}, ` : ""}{ring ? <>I&rsquo;ll call you at {tel(booked.phone)}.</> : <>see you on Google Meet. The link is in your confirmation email.</>}</p>
            ) : (
              <p className="ed-why">{first ? `${first}, a` : "A"} confirmation is on its way to <span className="ed-nb">{booked.email}</span>. I&rsquo;ll contact you with the further details before the day.</p>
            )}
          </div>
          <div className="ed-r">
            {rows.map(([k, v]) => (
              <div key={k} className="ed-row"><span className="label">{k}</span><span className="ed-v break-words">{v}</span></div>
            ))}
            <div className="ed-next">
              <span className="label">Next</span>
              <span>The confirmation is in your inbox now.</span>
              <span>Need another time? The email has a link to move or cancel it.</span>
            </div>
          </div>
        </div>
        <div className="ed-floor">
          <span className="label">San Jose, CA · {tzName}</span>
          <Link href="/portfolio" className="label ed-quiet text-foreground">See the work &rarr;</Link>
        </div>
      </div>
    );
  }
  const head = view === "week" ? week[0] : anchor;
  const name = view === "week" && week[0].getMonth() !== week[6].getMonth() ? `${mon(week[0])} / ${mon(week[6])}` : MONTHS[head.getMonth()];
  const year = (view === "week" ? week[6] : anchor).getFullYear();
  const last = view === "week" ? week[6] : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  // Nothing to go on to past the times asked for.
  const atEnd = +last >= +today + AHEAD * 864e5;
  const dayPick = (id: string) => {
    choose(id, pick.min, false);
    if (root.current?.dataset.fit === "3") setMstep("times");
    showTimes();
  };
  /* Julian (via MAC, 2026-10-20): the day's times in a line or two, no
     morning, afternoon or evening. One line when they fit at 5.75rem,
     else two even rows. */
  const dayTimes = days[pick.date] ?? [];
  const cols = dayTimes.length * 92 + (dayTimes.length - 1) * 8 <= slotsW ? dayTimes.length : Math.ceil(dayTimes.length / 2);
  const cells = [...month, ...Array.from({ length: (7 - (month.length % 7)) % 7 }, () => null)];
  const opts = needsWhere ? WHERE[slug] : undefined;
  const asking = opts?.find(([label]) => label === opt)?.[1];
  return (
    <div ref={root} aria-label={title} role="region" data-view={view} data-mstep={mstep} className={cn("tp ed", className)}>
      {busy}
      {bar}
      {step === "pick"
        ? hero(`${d3(date)} ${date.getDate()} ${mon(date)}`, <>{chosen === "time" ? `${t}${ap === apEnd ? "" : ` ${ap}`} to ${until} ${apEnd}` : "Pick a time"}<br />{what}</>, chosen === "time" ? "Then your details" : "Pick a day, then a time")
        : hero("Details", <>{dayLine}<br />{what}</>, "Who and where", <button type="button" data-stick={goo() ? "fill" : undefined} className="ed-box" onClick={() => setStep("pick")}>Change</button>)}
      {step === "pick" ? (
        <>
          <div className="ed-body">
            <div className="ed-l">
              <div className="ed-head">
                <h2>
                  {name}
                  {year !== today.getFullYear() ? <span className="label">{year}</span> : null}
                </h2>
                <div className="ed-ctl label">
                  {(["week", "month"] as const).map((v) => (
                    <button key={v} type="button" aria-pressed={view === v} onClick={() => switchView(v)}>{v}</button>
                  ))}
                  <button type="button" data-stick={goo() ? "" : undefined} className="ed-arrow" aria-label="Earlier" disabled={atStart} onClick={() => shift(-1)}>{arrow}</button>
                  <button type="button" data-stick={goo() ? "" : undefined} className="ed-arrow" aria-label="Later" disabled={atEnd} onClick={() => shift(1)}><span className="flex rotate-180">{arrow}</span></button>
                </div>
              </div>
              <div ref={daysBox} className="touch-pan-y overflow-hidden" {...swipeProps}>
                {view === "week" ? (
                  <div className="ed-week">
                    {week.map((d) => {
                      const id = iso(d);
                      return (
                        <button key={id} data-day={id} type="button" disabled={!open(id).size} aria-pressed={pick.date === id} aria-label={`${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`} onClick={() => dayPick(id)} className="ed-day">
                          <span className="label">{DAYS[d.getDay()]}</span>
                          <span className="ed-n">{d.getDate()}</span>
                          <i />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <div className="ed-mhead label">{DAYS.map((d) => <span key={d}>{d}</span>)}</div>
                    <div className="ed-month">
                      {cells.map((d, k) => {
                        /* The days either side of the month, barely there (Julian, 2026-10-20). */
                        if (!d) {
                          const lead = month.findIndex(Boolean);
                          const n = k < lead ? new Date(anchor.getFullYear(), anchor.getMonth(), k - lead + 1).getDate() : k - month.length + 1;
                          return <span key={`b${k}`} aria-hidden className="ed-blank">{n}</span>;
                        }
                        const id = iso(d);
                        return (
                          <button key={id} data-day={id} type="button" disabled={!open(id).size} aria-pressed={pick.date === id} aria-label={`${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`} onClick={() => dayPick(id)} data-stick={goo() && open(id).size ? "fill" : undefined} className="ed-cell">
                            <span className="ed-n">{d.getDate()}</span>
                            <i />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div ref={slotsRef} className="ed-r ed-times">
              <button type="button" className="ed-back label" onClick={() => setMstep("days")}>
                {arrow}
                {view === "month" ? MONTHS[anchor.getMonth()] : "Week"}
              </button>
              <p className="ed-on label">{`${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`}</p>
              {dayTimes.length ? (
                <div className="ed-slots" style={{ gridTemplateColumns: `repeat(${Math.max(1, cols)}, minmax(0, 1fr))` }}>
                  {dayTimes.map((x) => {
                    const m = minutesOf(x.start);
                    const [h, a] = clock(m);
                    return (
                      <button key={x.start} data-slot="" type="button" aria-pressed={chosen === "time" && m === pick.min} aria-label={`${h} ${a}`} onClick={() => choose(pick.date, m, true)} data-stick={goo() ? "fill" : undefined} className="ed-slot">{h} {a}</button>
                    );
                  })}
                </div>
              ) : (
                <p className="ed-none label">No open times this day.</p>
              )}
            </div>
          </div>
          <div className="ed-floor">
            <span className="label flex flex-col gap-1">
              {chosen === "time" ? `${sum} ${tzName}` : `San Jose, CA · ${here}${tz === TZ ? "" : ` · times in ${tzName}`}`}
            </span>
            <button type="button" data-stick={goo() ? "fill" : undefined} className="ed-btn" onClick={() => setOk("spin")} disabled={chosen !== "time"} aria-busy={!!ok}>
              <span className={cn("transition-opacity duration-200", ok && "opacity-0")}>Continue</span>
              {okMark}
            </button>
          </div>
        </>
      ) : (
        <form
          ref={refill}
          onSubmit={(e) => {
            e.preventDefault();
            void book(new FormData(e.currentTarget));
          }}
          className="ed-form flex min-h-0 flex-1 flex-col"
        >
          <div className="ed-body">
            <div className="ed-r ed-fields">
              {call ? (
                <div className="ed-row" role="radiogroup" aria-label="Phone call or video call">
                  <span className="label">Call</span>
                  <div className="ed-opts">
                    {(["Video", "Phone"] as const).map((v) => (
                      <label key={v} data-stick={goo() ? "fill" : undefined}>
                        <input type="radio" name="via" value={v} checked={via === v} onChange={() => setVia(v)} className="sr-only" />
                        <span className="ed-via">{v === "Video" ? camera : handset}{v} call</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="ed-row">
                <span className="label">Name</span>
                <span className="ed-pair">
                  <label><span className="sr-only">First name</span><input name="first" required autoComplete="given-name" placeholder="First" /></label>
                  <label><span className="sr-only">Last name</span><input name="last" required autoComplete="family-name" placeholder="Last" /></label>
                </span>
              </div>
              <label className="ed-row"><span className="label">Email</span><input name="email" type="email" required autoComplete="email" /></label>
              <label className="ed-row"><span className="label">{call && via === "Phone" ? "Call me at" : "Phone"}</span><input name="phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="(408) 555 0134" /></label>
              {opts && opts.length > 1 ? (
                <div className="ed-row" role="radiogroup" aria-label="Location">
                  <span className="label">Location</span>
                  <div className="ed-opts">
                    {opts.map(([label, q]) => (
                      <label key={label} data-stick={goo() ? "fill" : undefined}>
                        <input type="radio" name="opt" value={label} required checked={opt === label} onChange={() => { setOpt(label); if (q) setAsk(q); }} className="sr-only" />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              {asking ? <label className="ed-row"><span className="label">{ask}</span><input name="detail" required /></label> : null}
              {needsWhere && !opts ? <label className="ed-row"><span className="label">Where</span><input name="where" required placeholder="The studio, or an address" /></label> : null}
              <label className="ed-row"><span className="label">Notes</span><textarea name="notes" rows={2} autoComplete="off" onInput={grow} placeholder="Optional" className="tp-notes" /></label>
              {error ? <p role="alert" className="ed-err">{error}</p> : null}
            </div>
          </div>
          <div className="ed-floor">
            <span className="label">{paid ? "Next: $100 deposit" : `${sum} ${tzName}`}</span>
            <button type="submit" data-stick={goo() ? "fill" : undefined} className="ed-btn" disabled={step === "sending"}>{paid ? "Continue" : step === "sending" ? "Booking" : "Book it"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
