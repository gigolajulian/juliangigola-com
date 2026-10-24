"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CalEmbed } from "@/components/cal-embed";
import { Calendar, Failed, Field, FlowShell, Hidden, Run, dlabel, duration, iso, useEnquiry, type Shell } from "@/components/v3/flow";
import { LENGTH, SESSIONS, TAB_ORDER, rate, type SessionSlug } from "@/lib/v3";

/* JG V3 booking (master v39, /book/<session>): one stepper. The sessions
   with a time book through Cal.com and the $100 deposit as before
   (`time-picker.tsx`, `deposit-step.tsx`); weddings are on request and post
   through the enquiry action. */

function Tabs({ at }: { at: SessionSlug }) {
  const router = useRouter();
  return (
    <div className="stabs lbl" role="group" aria-label="Session">
      {TAB_ORDER.map((x) => (
        <button key={x} type="button" aria-pressed={x === at} onClick={() => router.replace(`/book/${x}`, { scroll: false })}>
          <b>{SESSIONS[x].name}</b>
          <span>{rate(SESSIONS[x])}</span>
        </button>
      ))}
    </div>
  );
}

export function V3BookFlow({ slug }: { slug: SessionSlug }) {
  const S = SESSIONS[slug];
  const shell: Shell = (p) => (
    <FlowShell
      {...p}
      body={
        p.at === 1 ? (
          <>
            {TAB_ORDER.includes(slug) ? <Tabs at={slug} /> : null}
            <Run className="inc lbl" items={[...S.includes, ...(S.turnaround ? [`Ready in ${S.turnaround}`] : [])]} />
            {p.body}
          </>
        ) : (
          p.body
        )
      }
      sum={[["Session", rate(S)], ...p.sum]}
      photo={S.photo}
      name={S.name}
    />
  );
  if (!S.cal) return <OnRequest key={slug} slug={slug} shell={shell} />;
  return <CalEmbed key={slug} path={S.cal} title={`Pick a time for ${S.name}`} v3={{ shell, name: S.name, from: S.from }} />;
}

export function V3Book({ slug }: { slug: SessionSlug }) {
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-flow">
        <V3BookFlow slug={slug} />
      </section>
    </div>
  );
}

/* Weddings: Date, Shoot, You, Sent. Nothing is booked; the request is an
   enquiry and the date is confirmed with a quote. */
function OnRequest({ slug, shell }: { slug: SessionSlug; shell: Shell }) {
  const S = SESSIONS[slug];
  const { state, pending, sent, send } = useEnquiry();
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [k, setK] = React.useState(1);
  const [view, setView] = React.useState<"week" | "month">("month");
  const [day, setDay] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  const [anchor, setAnchor] = React.useState(day);
  const [where, setWhere] = React.useState<"studio" | "location">("studio");
  const [v, setV] = React.useState({ idea: "", name: "", email: "", phone: "", note: "" });
  const [err, setErr] = React.useState<Record<string, string>>({});
  const f = (key: keyof typeof v) => ({ k: key, value: v[key], err: err[key], onChange: (x: string) => setV({ ...v, [key]: x }) });
  const at = sent ? 4 : k;
  React.useEffect(() => {
    if (sent) scrollTo(0, 0);
  }, [sent]);
  const go = (n: number) => {
    setK(n);
    scrollTo(0, 0);
  };
  const place = where === "studio" ? "Studio in San Jose" : "On location";
  const sum: [string, React.ReactNode][] = [["Date", dlabel(day)], ...(LENGTH[slug] ? [["Length", duration(LENGTH[slug])] as [string, string]] : [])];
  const monday = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const canBack = view === "week" ? +monday(anchor) > +monday(today) : anchor.getFullYear() * 12 + anchor.getMonth() > today.getFullYear() * 12 + today.getMonth();
  const steps = ["Date", "Shoot", "You", "Sent"];

  let parts: Omit<Parameters<Shell>[0], "steps" | "at" | "sum">;
  if (at === 1) {
    parts = {
      head: "Book a session",
      sub: "My studio is in San Jose, and I travel across the Bay Area.",
      body: (
        <>
          <Calendar
            view={view}
            setView={(x) => { setView(x); setAnchor(day); }}
            anchor={anchor}
            shift={(dir) => {
              const d = new Date(anchor);
              if (view === "week") d.setDate(d.getDate() + 7 * dir);
              else d.setMonth(d.getMonth() + dir, 1);
              setAnchor(d);
            }}
            canBack={canBack}
            picked={iso(day)}
            tag={(d) => (d > today ? "Open" : null)}
            onPick={setDay}
          />
          <p className="lbl mute">{S.name} is on request. Pick a preferred date and I&apos;ll confirm it with a quote.</p>
        </>
      ),
      bar: <button type="button" className="btn fill" onClick={() => go(2)}>Continue</button>,
    };
  } else if (at === 2) {
    parts = {
      head: "Your shoot",
      sub: "Tell me what you have in mind and I'll send a quote.",
      body: (
        <>
          <div className="fld" role="group" aria-label="Where">
            <span className="lbl mute">Where</span>
            <div className="times lbl" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {(["studio", "location"] as const).map((x) => (
                <button key={x} type="button" className="opt" aria-pressed={x === where} onClick={() => setWhere(x)}>{x === "studio" ? "Studio in San Jose" : "On location"}</button>
              ))}
            </div>
          </div>
          <Field label="What you have in mind" area {...f("idea")} />
        </>
      ),
      bar: (
        <>
          <button type="button" className="btn" onClick={() => go(1)}>Back</button>
          <button type="button" className="btn fill" onClick={() => go(3)}>Continue</button>
        </>
      ),
    };
  } else if (at === 3) {
    parts = {
      head: "About you",
      sub: "I reply to this email.",
      body: (
        <>
          <Field label="Name" ac="name" req {...f("name")} />
          <Field label="Email" type="email" ac="email" req {...f("email")} />
          <Field label="Phone" type="tel" ac="tel" {...f("phone")} />
          <Field label="Anything I should know" {...f("note")} />
          <Failed state={state} />
        </>
      ),
      bar: (
        <>
          <button type="button" className="btn" onClick={() => go(2)}>Back</button>
          <button type="submit" className="btn fill" disabled={pending}>Send request</button>
        </>
      ),
    };
  } else {
    parts = {
      ok: "Sent",
      head: "Sent.",
      sub: "I'll reply with a quote.",
      body: (
        <div className="done-lines">
          {[`${S.name}, around ${dlabel(day)}${where === "studio" ? ", in the San Jose studio." : ", on location."}`, "A copy of your request is in your inbox.", "Nothing is charged until you accept the quote."].map((l) => <p key={l}>{l}</p>)}
        </div>
      ),
      bar: <Link className="btn fill" href="/portfolio">See the work</Link>,
    };
  }

  /* The enquiry needs a message; the date stands in when nothing is written. */
  const message = [v.idea.trim(), v.phone.trim() && `Phone: ${v.phone.trim()}`, v.note.trim()].filter(Boolean).join("\n\n") || `${S.name}, preferred date ${dlabel(day)}.`;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const no: Record<string, string> = {};
        if (!v.name.trim()) no.name = "Add your name so I know who to reply to.";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) no.email = "That email looks incomplete. Check it and try again.";
        setErr(no);
        if (Object.keys(no).length) return e.currentTarget.querySelector<HTMLElement>(`#f-${Object.keys(no)[0]}`)?.focus();
        send(e.currentTarget);
      }}
    >
      <Hidden type={S.type ?? "session"} detail={`${dlabel(day)} · ${place}`} />
      <input type="hidden" name="session" value={S.name} />
      <input type="hidden" name="message" value={message} />
      {shell({ steps, at, sum, ...parts })}
    </form>
  );
}

/** "Schedule a call" on Inquire: the consultation as a card over the page.
    Out of the photo card's markup (its light type), in a `.v3` of its own. */
export function CallDialog() {
  const dlg = React.useRef<HTMLDialogElement>(null);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (open) dlg.current?.showModal();
  }, [open]);
  return (
    <>
      <Link
        className="btn fill"
        href="/book/consultation"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        Schedule a call
      </Link>
      {open
        ? createPortal(
            <div className="v3 contents">
              <dialog
                ref={dlg}
                className="calldlg"
                aria-label="Book a consultation"
                onClose={() => setOpen(false)}
                onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
              >
                <div className="dlg-x">
                  <button type="button" onClick={() => dlg.current?.close()}>Close</button>
                </div>
                <V3BookFlow slug="consultation" />
              </dialog>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
