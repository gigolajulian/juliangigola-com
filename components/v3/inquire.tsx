"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReferencePicks } from "@/components/reference-picks";
import { V3Foot } from "@/components/v3/chrome";
import { CallDialog } from "@/components/v3/book";
import { Duo } from "@/components/v3/duo";
import { Check, Failed, Field, FlowShell, Hidden, NEED_MSG, checkYou, first, useEnquiry } from "@/components/v3/flow";
import { CALL_CARD, DOORS } from "@/lib/v3";

/* JG V3 Inquire (master v39, /inquire and /inquire/form). Both forms post
   through the site's enquiry action (`app/contact/actions.ts`) with its
   honeypot and visit context; `?sim=sent` (dev only) shows Sent without
   sending, as `?sim` does on the deposit. */

function Note() {
  const { state, pending, sent, send } = useEnquiry();
  const [v, setV] = React.useState({ name: "", email: "", message: "" });
  const [err, setErr] = React.useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const fld = (k: keyof typeof v, label: string, el: React.ReactNode) => (
    <div className={err[k] ? "fld bad" : "fld"}>
      <label className="lbl mute" htmlFor={`r-${k}`}>
        <span>
          {label}
          <span className="req" aria-hidden="true"> *</span>
        </span>
      </label>
      {el}
      {err[k] ? <p className="err" role="alert">{err[k]}</p> : null}
    </div>
  );
  return (
    <form
      className="reach-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const bad = checkYou(v.name, v.email);
        if (!v.message.trim()) bad.message = NEED_MSG;
        setErr(bad);
        const form = e.currentTarget;
        if (Object.keys(bad).length) return form.querySelector<HTMLElement>(`#r-${Object.keys(bad)[0]}`)?.focus();
        send(form);
      }}
    >
      <Hidden type="other" />
      <div className="reach-fields" hidden={sent}>
        <span className="lbl mute">Write to me</span>
        <h3>Start a project</h3>
        <p className="mute">A few lines is enough. Dates and a reference help.</p>
        <div className="reach-row">
          {fld("name", "Name", <input id="r-name" name="name" autoComplete="name" aria-required placeholder="Your name" value={v.name} onChange={set("name")} aria-invalid={!!err.name || undefined} />)}
          {fld("email", "Email", <input id="r-email" name="email" type="email" autoComplete="email" aria-required placeholder="you@email.com" value={v.email} onChange={set("email")} aria-invalid={!!err.email || undefined} />)}
        </div>
        {fld("message", "Message", <textarea id="r-message" name="message" rows={4} aria-required placeholder="What are you planning, and when?" value={v.message} onChange={set("message")} aria-invalid={!!err.message || undefined} />)}
        <ReferencePicks resync={state} v3 />
        <Failed state={state} />
        <div className="reach-send">
          <button className="btn fill" type="submit" disabled={pending}>Send note</button>
        </div>
      </div>
      <div className="reach-out" hidden={!sent} role="status">
        <span className="f-ok lbl"><Check />Sent</span>
        <b>Thanks, {first(v.name)}.</b>
        <p className="mute">A copy is in your inbox.</p>
      </div>
    </form>
  );
}

export function V3Inquire() {
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-inquire">
        <div className="pg-head"><h1 className="pg-t">Get in touch</h1></div>
        <div className="reach">
          <Note />
          <div className="reach-call">
            <Duo d={CALL_CARD.d} l={CALL_CARD.l} alt="" sizes="(max-width: 800px) 100vw, 40vw" />
            <div className="rc-in">
              <span className="lbl">Prefer to talk</span>
              <h3>Book a consultation</h3>
              <p>15 minutes, phone or video. Pick a time on my calendar.</p>
              <div><CallDialog /></div>
            </div>
          </div>
        </div>
        <div className="ab-steps in-steps">
          <h2 className="lbl mute">How a commission runs</h2>
          <ol>
            {STEPS.map(([t, d], i) => (
              <li key={t}><span className="lbl mute">{`0${i + 1}`}</span><b>{t}</b><p>{d}</p></li>
            ))}
          </ol>
        </div>
        <div className="doors ch-doors">
          <Link className="door" href="/contact/form">
            <Duo d={DOORS.commissions.d} l={DOORS.commissions.l} alt="" sizes="(max-width: 800px) 100vw, 50vw" />
            <span className="lbl mute">For art directors and artists</span>
            <h3>Commissions</h3>
            <p>Campaigns, editorial, cover art and presskits. Three short steps.</p>
            <div><span className="btn fill">Start an inquiry</span></div>
          </Link>
          <Link className="door" href="/book">
            <Duo d={DOORS.book.d} l={DOORS.book.l} alt="" sizes="(max-width: 800px) 100vw, 50vw" />
            <span className="lbl mute">For private clients</span>
            <h3>Book a session</h3>
            <p>Portraits, graduation, headshots, studio digitals and weddings.</p>
            <div><span className="btn fill">Pick a session</span></div>
          </Link>
        </div>
        <div className="direct lbl">
          <span className="mute">Or write directly</span>
          <a href="mailto:hello@juliangigola.com">hello@juliangigola.com</a>
          <a href="https://instagram.com/juliangigola" rel="noopener">@juliangigola</a>
        </div>
        <V3Foot />
      </section>
    </div>
  );
}

const STEPS = [
  ["Brief", "References, usage, deliverables and dates. A deck is welcome but not required."],
  ["Treatment", "A lighting and location approach, a shot list and a quote covering crew and licensing."],
  ["Shoot", "Studio or location, Bay Area or traveling. Art direction on request."],
  ["Delivery", "Selects for approval, then final retouched files in the crops and color spaces you need."],
] as const;

/* ── /contact/form: the commission stepper (Project, Scope, You, Sent) ── */
const KINDS = ["Brand campaign", "Editorial", "Cover art", "Artist presskit", "Music video", "Event coverage", "Other"];
const WHEN = ["This month", "Next month", "Later this year", "Flexible"];
const BUDGET = ["Under $2k", "$2k to $5k", "$5k to $10k", "$10k and up", "Not sure yet"];
/* The inbox's shoot types (lib/inbox.ts SHOOT_TYPES). */
const TYPE: Record<string, string> = { "Brand campaign": "campaign", Editorial: "editorial", "Cover art": "coverart", "Artist presskit": "presskit", "Music video": "video", "Event coverage": "event" };

export function V3Commission() {
  const router = useRouter();
  const { state, pending, sent, send } = useEnquiry();
  const [k, setK] = React.useState(1);
  const [kinds, setKinds] = React.useState<string[]>([]);
  const [pick, setPick] = React.useState({ when: "", budget: "" });
  const [v, setV] = React.useState({ place: "", name: "", email: "", org: "", msg: "" });
  const [err, setErr] = React.useState<Record<string, string>>({});
  const f = (key: keyof typeof v) => ({ k: key, value: v[key], err: err[key], onChange: (x: string) => setV({ ...v, [key]: x }) });
  const at = sent ? 4 : k;
  const top = () => scrollTo(0, 0);
  React.useEffect(() => {
    if (sent) scrollTo(0, 0);
  }, [sent]);

  const sum: [string, React.ReactNode][] = [["Project", kinds.length ? kinds.join(", ") : "Not picked yet"]];
  if (at >= 2 && pick.when) sum.push(["When", pick.when]);
  if (at >= 2 && pick.budget) sum.push(["Budget", pick.budget]);
  if (at >= 3 && v.org) sum.push(["From", v.org]);

  let head: string, sub: string, body: React.ReactNode, cta = "Continue";
  if (at === 1) {
    head = "Have something in mind?";
    sub = "Campaigns, editorial, cover art and presskits. I come back with an approach and a quote.";
    body = (
      <>
        <span className="lbl mute">Pick all that fit</span>
        <div className="kinds">
          {KINDS.map((x) => {
            const on = kinds.includes(x);
            return (
              <button key={x} type="button" className="kind" aria-pressed={on} onClick={() => setKinds(on ? kinds.filter((y) => y !== x) : [...kinds, x])}>
                <b>{x}</b>
                <span className="lbl">{on ? "Picked" : ""}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  } else if (at === 2) {
    head = "Scope";
    sub = "A rough answer is enough.";
    body = (
      <>
        {([["When", "when", WHEN], ["Budget", "budget", BUDGET]] as const).map(([l, key, opts]) => (
          <div key={key} className="fld" role="group" aria-label={l}>
            <span className="lbl mute">{l}</span>
            <div className="wrapopts lbl">
              {opts.map((o) => (
                <button key={o} type="button" className="opt" aria-pressed={pick[key] === o} onClick={() => setPick({ ...pick, [key]: o })}>{o}</button>
              ))}
            </div>
          </div>
        ))}
        <Field label="Where" {...f("place")} />
      </>
    );
  } else if (at === 3) {
    head = "About you";
    /* The master adds "usually the same day"; no reply promise on the site. */
    sub = "I reply to this email.";
    body = (
      <>
        <Field label="Name" ac="name" req {...f("name")} />
        <Field label="Email" type="email" ac="email" req {...f("email")} />
        <Field label="Company or artist" ac="organization" {...f("org")} />
        <ReferencePicks resync={state} v3 />
        <Field label="What you have in mind" area req {...f("msg")} />
        <Failed state={state} />
      </>
    );
    cta = "Send inquiry";
  } else {
    head = "Sent.";
    sub = `Thanks${v.name.trim() ? `, ${first(v.name)}` : ""}. I'll come back with an approach and a quote.`;
    body = (
      <div className="done-lines">
        {[
          `${kinds.length ? kinds.join(" and ") : "Your project"}${pick.when ? `, ${pick.when.toLowerCase()}` : ""}${pick.budget ? `, ${pick.budget}` : ""}.`,
          `A copy is in your inbox at ${v.email}.`,
          "If it is urgent, say so in a reply and I will call.",
        ].map((l) => <p key={l}>{l}</p>)}
      </div>
    );
    cta = "See the work";
  }

  const detail = [kinds.join(", "), pick.when, pick.budget, v.place.trim(), v.org.trim()].filter(Boolean).join(" · ");
  const message = v.msg.trim();
  const next = (form: HTMLFormElement) => {
    if (at === 4) return router.push("/portfolio");
    if (at < 3) {
      setK(at + 1);
      return top();
    }
    const bad = checkYou(v.name, v.email);
    if (!v.msg.trim()) bad.msg = NEED_MSG;
    setErr(bad);
    if (Object.keys(bad).length) return form.querySelector<HTMLElement>(`#f-${Object.keys(bad)[0]}`)?.focus();
    send(form);
  };

  return (
    <div className="v3 contents">
      <section className="v3page" id="p-flow">
        <form noValidate onSubmit={(e) => { e.preventDefault(); next(e.currentTarget); }}>
          <Hidden type={TYPE[kinds[0]] ?? "other"} detail={detail} />
          <input type="hidden" name="message" value={message} />
          <FlowShell
            steps={["Project", "Scope", "You", "Sent"]}
            at={at}
            ok={at === 4 ? "Sent" : undefined}
            head={head}
            sub={sub}
            body={body}
            bar={
              <>
                {at > 1 && at < 4 ? <button type="button" className="btn" onClick={() => { setK(at - 1); top(); }}>Back</button> : null}
                <button type="submit" className="btn fill" disabled={pending}>{cta}</button>
              </>
            }
            photo={{ d: DOORS.commissions.d, l: DOORS.commissions.d }}
            name="Commissions"
            sum={sum}
          />
        </form>
      </section>
    </div>
  );
}
