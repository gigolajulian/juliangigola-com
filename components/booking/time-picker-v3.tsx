"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DepositStep } from "@/components/booking/deposit-step";
import { ReferencePicks } from "@/components/reference-picks";
import { Calendar } from "@/components/v3/flow";
import { dlabel } from "@/components/v3/flow";
import { duration } from "@/lib/booking/booking-rules";
import { fmt } from "@/components/v3/flow";
import type { Shell } from "@/components/v3/flow";
import { looksLikeEmail } from "@/lib/inbox";
import { AHEAD, fromIso, iso, minutesOf, recent, STEP_AT, WHERE, clock, type V3Book } from "@/components/booking/time-picker-parts";
import type { CardCtx } from "@/components/booking/use-picker";

/** The quiet that ends a trackpad flick: events closer than this are still the same push. */
const GESTURE_GAP_MS = 120;

/* JG V3 (master v39 stepper): Time, You, (Deposit), Booked. The same
   times, booking and deposit as the cards; only the look is new. */
export function V3Steps({ c }: { c: CardCtx & { v3: V3Book } }) {
  const { v3, username, slug, tz, length, needsWhere, opt, setOpt, booked, days, view, setView, anchor, setAnchor, pick, chosen, setChosen, step, setStep, swipeX: swipeXRef, wheelGate, stripRef, more, setMore, paid, deposit, refs, v3root, error, bad, setBad, blank, setBlank, load, choose, today, book, refill, v3steps, v3sub, date } = c;
  const end = pick.min + length;
  const range = `${fmt(pick.min)} to ${fmt(end)}`;
  const at = step === "done" ? v3steps.length : STEP_AT[step] + 1;
  const rows: [string, React.ReactNode][] = [["Day", dlabel(date)], ["Time", range], ["Length", duration(length)]];
  const shell = (p: Omit<Parameters<Shell>[0], "steps" | "at" | "sum">) => <div ref={v3root} className="contents">{v3.shell({ steps: v3steps, at, sum: rows, ...p })}</div>;
  const back = (to: typeof step) => <button type="button" className="btn" onClick={() => { setBad({}); setStep(to); }}>Back</button>;
  if (step === "pay" && deposit) {
    const price = v3.from != null ? `$${v3.from}` : "Quoted";
    return (
      <DepositStep
        v3={(p) => shell(p)}
        head={<div className="fig"><b>$100</b><span className="lbl mute">Holds {dlabel(date)}, {fmt(pick.min)}</span></div>}
        body={deposit}
        refs={refs}
        rows={[
          [`${v3.name}, ${duration(length)}`, price],
          ["Deposit today", "$100"],
          ["Balance after the shoot", v3.from != null ? `$${v3.from - 100}` : "Rest of the quote"],
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
    );
  }
  if (step === "done") {
    const studio = !booked.where || /studio/i.test(booked.where);
    const lines = paid
      ? [`${dlabel(date)}, ${range}, ${duration(length)}.`, studio ? "San Jose studio. I send the address the day before." : `${booked.where}.`, "Need to move it? Reply to the confirmation up to 48 hours before."]
      : [`${dlabel(date)}, ${range}, ${duration(length)}.`, "I call the number you gave, or send a video link the day before.", "Need to move it? Reply to the confirmation."];
    const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, "");
    const s0 = +new Date(pick.start);
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `UID:${s0}@juliangigola.com`, `DTSTAMP:${stamp(s0)}`, `DTSTART:${stamp(s0)}`, `DTEND:${stamp(s0 + length * 6e4)}`, `SUMMARY:${v3.name} with Julian Gigola`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return shell({
      ok: "Booked",
      head: `${booked.name}, you're in.`,
      sub: `Your confirmation is on its way to ${booked.email}.`,
      body: <div className="done-lines">{lines.map((l) => <p key={l}>{l}</p>)}</div>,
      bar: (
        <>
          <a className="btn" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download="julian-gigola.ics">Add to calendar</a>
          <Link className="btn fill" href="/portfolio">See the work</Link>
        </>
      ),
    });
  }
  if (step !== "pick") {
    const opts = needsWhere ? WHERE[slug] : undefined;
    const asking = opts?.find(([label]) => label === (opt || opts[0][0]))?.[1];
    const f = (k: string, label: string, type = "text", hint = "", ac = "off", area = false, req = false) => {
      const id = `f-${k}`;
      return (
        <div className={bad[k] ? "fld bad" : "fld"}>
          <label className="lbl mute" htmlFor={id}><span>{label}{req ? <span className="req" aria-hidden="true"> *</span> : null}</span>{bad[k] && !blank[k] ? <span className="fe" aria-hidden="true">{bad[k]}</span> : <span>{hint}</span>}</label>
          {area ? <textarea id={id} name={k} rows={3} placeholder={bad[k] && blank[k] ? bad[k] : undefined} aria-invalid={!!bad[k] || undefined} aria-describedby={bad[k] ? `${id}-err` : undefined} aria-required={req || undefined} /> : <input id={id} name={k} type={type} autoComplete={ac} placeholder={bad[k] && blank[k] ? bad[k] : undefined} aria-invalid={!!bad[k] || undefined} aria-describedby={bad[k] ? `${id}-err` : undefined} aria-required={req || undefined} />}
          {bad[k] ? <p className="sr-only" id={`${id}-err`} role="alert">{bad[k]}</p> : null}
        </div>
      );
    };
    return (
      <form
        ref={refill}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const no: Record<string, string> = {};
          if (!String(data.get("name") || "").trim()) no.name = "Add your name";
          if (!looksLikeEmail(String(data.get("email") || "").trim())) no.email = "Email looks incomplete";
          setBad(no);
          setBlank({ name: !String(data.get("name") || "").trim(), email: !String(data.get("email") || "").trim() });
          if (Object.keys(no).length) return form.querySelector<HTMLElement>(`#f-${Object.keys(no)[0]}`)?.focus();
          void book(data);
        }}
      >
        {shell({
          head: "About you",
          sub: "Your confirmation goes to this email.",
          body: (
            <>
              {/* The photo's summary hides on phones: the day and time stay in view here (booking critique, 2026-11-04). */}
              <p className="f-when lbl mute">{dlabel(date)} | {fmt(pick.min)} | {v3.name}</p>
              {f("name", "Name", "text", "", "name", false, true)}
              {f("email", "Email", "email", "", "email", false, true)}
              {f("phone", "Phone", "tel", "", "tel")}
              {opts && opts.length > 1 ? (
                <div className="fld" role="group" aria-label="Where">
                  <span className="lbl mute">Where</span>
                  <input type="hidden" name="opt" value={opt || opts[0][0]} />
                  <div className="wrapopts lbl">
                    {opts.map(([label]) => (
                      <button key={label} type="button" className="opt" aria-pressed={(opt || opts[0][0]) === label} onClick={() => setOpt(label)}>{label}</button>
                    ))}
                  </div>
                </div>
              ) : null}
              {asking ? f("detail", asking) : null}
              {needsWhere && !WHERE[slug] ? f("where", "Where") : null}
              {f("notes", "Anything I should know")}
              {paid ? <ReferencePicks resync={null} v3 /> : null}
              {error ? <p className="err" role="alert">{error}</p> : null}
              {/* The deposit terms before the commit, in deposit-step's wording. */}
              {paid ? <p className="lbl mute">Refundable or transferable up to 48 hours before the shoot. The balance is due after the shoot.</p> : null}
            </>
          ),
          bar: (
            <>
              {back("pick")}
              <button type="submit" className="btn fill" disabled={step === "sending" || step === "check"}>{paid ? "Continue to $100 deposit" : "Book the call"}</button>
            </>
          ),
        })}
      </form>
    );
  }
  const monday = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const canBack = view === "week" ? +monday(anchor) > +monday(today) : anchor.getFullYear() * 12 + anchor.getMonth() > today.getFullYear() * 12 + today.getMonth();
  const canNext = +(view === "week" ? monday(anchor) : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)) < +today + AHEAD * 864e5;
  const times = days[pick.date] ?? [];
  const [hh, mm] = clock(pick.min)[0].split(":");
  const at0 = times.findIndex((x) => minutesOf(x.start) === pick.min);
  const stepTime = (dir: number) => {
    const next = times[at0 + dir];
    if (next) choose(pick.date, minutesOf(next.start), true);
  };
  return shell({
    head: paid ? "Book a session" : v3?.name === "Consultation" ? "Book a consultation" : "Book a call",
    sub: v3sub,
    body: (
      // Rises in once the times arrive, in place of "Loading availability" (Julian, 2026-10-27).
      <div className="f-in">
        <Calendar
          view={view}
          setView={(v) => { setView(v); setAnchor(fromIso(pick.date)); }}
          anchor={anchor}
          shift={(dir) => {
            const d = new Date(anchor);
            if (view === "week") d.setDate(d.getDate() + 7 * dir);
            else d.setMonth(d.getMonth() + dir, 1);
            setAnchor(d);
          }}
          canBack={canBack}
          canNext={canNext}
          picked={pick.date}
          tag={(d) => {
            const n = days[iso(d)]?.length ?? 0;
            return n ? `${n} open` : null;
          }}
          onPick={(d) => choose(iso(d), pick.min, false)}
        />
        {/* Option B (Julian, 2026-11-09, "build b"): the time big, stepped with
            the arrows, a wheel, a swipe or the arrow keys; the day's open times
            in one row under it, faded with a hint when they run past the edge. */}
        <div className="fig scrub">
          <div className="num">
            <b ref={(el) => {
              if (!el) return;
              /* A wheel over the number steps the time: a mouse once a notch, a
                 trackpad once a flick (its stream of events, until a gap of
                 GESTURE_GAP_MS, read as one). A flick that starts at
                 the first or last time is the page's. React's onWheel is passive. */
              const wheel = (e: WheelEvent) => {
                if (e.ctrlKey || !e.deltaY) return;
                const g = wheelGate.current;
                const fresh = e.timeStamp - g.at > GESTURE_GAP_MS;
                g.at = e.timeStamp;
                // Any pixel stream is one gesture: fast trackpad events pass NOTCH_PX on 2x screens (MAC, #741).
                const pad = e.deltaMode === 0;
                const dir = e.deltaY > 0 ? 1 : -1;
                if (fresh || !pad) g.owned = !!times[at0 + dir];
                if (!g.owned) return;
                e.preventDefault();
                if (fresh || !pad) stepTime(dir);
              };
              el.addEventListener("wheel", wheel, { passive: false });
              return () => el.removeEventListener("wheel", wheel);
            }} data-lenis-prevent tabIndex={0} role="spinbutton" aria-label="Time" aria-valuetext={fmt(pick.min)} data-scrub=""
              onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); stepTime(e.key === "ArrowRight" ? 1 : -1); } }}
              onPointerDown={(e) => { swipeXRef.current = e.clientX; }}
              /* One step per swipe, however long (Julian, 2026-11-10): the start clears until the finger lifts. */
              onPointerMove={(e) => { const x0 = swipeXRef.current; if (x0 != null && Math.abs(e.clientX - x0) > 36) { stepTime(e.clientX < x0 ? 1 : -1); swipeXRef.current = null; } }}
              onPointerUp={() => { swipeXRef.current = null; }}
              onPointerCancel={() => { swipeXRef.current = null; }}
            >{hh}<span className="cn">:</span>{mm}</b>
            <span className="lbl mute ap">{pick.min < 720 ? "AM" : "PM"}</span>
          </div>
          <div className="arrs">
            <button type="button" className="arr" aria-label="Earlier time" disabled={at0 <= 0} onClick={() => stepTime(-1)}>←</button>
            <button type="button" className="arr" aria-label="Later time" disabled={at0 < 0 || at0 >= times.length - 1} onClick={() => stepTime(1)}>→</button>
          </div>
          <span className="lbl mute mline">{dlabel(date)}{chosen === "time" ? ` | until ${fmt(end)}` : ""}</span>
        </div>
        <div className={cn("strip", more && "more")}>
          <div ref={stripRef} className="idx lbl" onScroll={(e) => { const el = e.currentTarget; setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4); }}>
            {times.map((x) => {
              const m = minutesOf(x.start);
              const [h, a] = clock(m);
              return (
                <button key={x.start} type="button" data-slot="" aria-pressed={m === pick.min} aria-label={fmt(m)} onClick={() => choose(pick.date, m, true)}>{h}<small>{a}</small></button>
              );
            })}
          </div>
          <p className="lbl mute swipe" aria-hidden>Swipe for more times →</p>
        </div>
      </div>
    ),
    bar: <button type="button" className="btn fill" onClick={() => { setChosen("time"); setStep("form"); }}>Continue</button>,
  });
}
