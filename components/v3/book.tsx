"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal, preload } from "react-dom";
import { getImageProps } from "next/image";
import { useRouter } from "next/navigation";
import { CalEmbed } from "@/components/cal-embed";
import { Calendar, Failed, Field, FlowShell, Hidden, Run, dlabel, duration, iso, useEnquiry, type Shell } from "@/components/v3/flow";
import { LENGTH, SESSIONS, TAB_ORDER, rate, type SessionSlug } from "@/lib/v3";

/* JG V3 booking (master v39, /book/<session>): one stepper. The sessions
   with a time book through Cal.com and the $100 deposit as before
   (`time-picker.tsx`, `deposit-step.tsx`); weddings are on request and post
   through the enquiry action. */

const TILES: SessionSlug[] = TAB_ORDER.filter((x) => x !== "consultation");
/* The route change remounts the tiles; the one picked by key takes focus back on mount. */
let keyedAt = 0;
const keepFocus = (el: HTMLButtonElement | null) => {
  if (el && Date.now() - keyedAt < 3000) el.focus();
};

function Tabs({ at }: { at: SessionSlug }) {
  const router = useRouter();
  /* One session at a time: the tapped tile lights at once, so the old one never
     stays lit beside it while the route loads on a slow tablet (Julian, 2026-11-04). */
  const [tap, setTap] = React.useState<{ from: SessionSlug; x: SessionSlug } | null>(null);
  const cur = tap?.from === at ? tap.x : at;
  const go = (x: SessionSlug) => {
    setTap({ from: at, x });
    router.replace(`/book/${x}`, { scroll: false });
  };
  /* The call is a way in, not a session: a quiet link under the grid (critique, 2026-10-29). */
  return (
    <>
      {/* A radio group moves on the arrow keys, one Tab stop for the group (QA on #589). */}
      <div
        className="stabs lbl"
        role="radiogroup"
        aria-label="Session"
        onKeyDown={(e) => {
          const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          const i = TILES.indexOf(cur);
          const n = e.key === "Home" ? 0 : e.key === "End" ? TILES.length - 1 : step ? (Math.max(i, 0) + step + TILES.length) % TILES.length : -1;
          if (n < 0) return;
          e.preventDefault();
          (e.currentTarget.children[n] as HTMLElement).focus();
          keyedAt = Date.now();
          go(TILES[n]);
        }}
      >
        {TILES.map((x, k) => (
          <button key={x} type="button" role="radio" aria-checked={x === cur} ref={x === cur ? keepFocus : undefined} tabIndex={x === cur || (k === 0 && !TILES.includes(cur)) ? 0 : -1} onClick={() => go(x)}>
            <b>{SESSIONS[x].name}</b>
            <span>{rate(SESSIONS[x])}</span>
          </button>
        ))}
      </div>
      <More on={cur === "consultation"} go={go} />
    </>
  );
}

/** The two ways out of the session grid: under the tiles on phones and upright
    tablets, as ruled rows under the photo beside the calendar (Julian, 2026-11-04). */
function More({ on, go }: { on: boolean; go: (x: SessionSlug) => void }) {
  return (
    <div className="stabs-more">
      <button type="button" className="stabs-call lbl" aria-pressed={on} onClick={() => go("consultation")}>
        <span className="q">Not sure what you need?</span> <span className="a">Book a 15 min call <i aria-hidden="true">&rarr;</i></span>
      </button>
      {/* The art director's way out of the session flow (booking critique, 2026-11-04). */}
      <Link href="/contact/form" prefetch={false} className="stabs-call lbl">
        <span className="q">Commission or campaign?</span> <span className="a">Inquire <i aria-hidden="true">&rarr;</i></span>
      </Link>
    </div>
  );
}

/* What the photo lists: the includes without the length line (the length is
   on the confirmation), the turnaround, then the price (Julian, 2026-11-04). */
const getList = (S: (typeof SESSIONS)[SessionSlug]) => {
  const r = rate(S);
  return [...S.includes.filter((x) => !/^(one hour|\d+ minutes)\b/i.test(x)), ...(S.turnaround ? [`Ready in ${S.turnaround}`] : []), /deposit$/.test(r) ? `${r} required` : r];
};

/** `tabs`: false where the page is already about one booking (the service pages). */
export function V3BookFlow({ slug, tabs = true, h1 = false }: { slug: SessionSlug; tabs?: boolean; h1?: boolean }) {
  const S = SESSIONS[slug];
  const router = useRouter();
  const more = tabs && TAB_ORDER.includes(slug);
  /* The other sessions' photographs, once the page is idle, at the very
     copy the photo slot will ask for (its `sizes`, the theme showing, the
     phone frame where there is one). Switching session swapped the src in
     place, and Safari showed the slot empty until the new file came: about
     80ms of nothing between Portraits and Headshots (MAC, 2026-11-08). */
  React.useEffect(() => {
    if (!more) return;
    const warm = () => {
      const light = document.documentElement.dataset.theme === "light";
      const phone = matchMedia("(max-width: 800px)").matches;
      for (const x of TAB_ORDER) {
        if (x === slug) continue;
        const ph = SESSIONS[x].photo;
        const src = phone && ph.m ? ph.m : light ? ph.l : ph.d;
        const { props } = getImageProps({ src, alt: "", fill: true, sizes: phone && ph.m ? "100vw" : "(max-width: 800px) 100vw, 44vw" });
        preload(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "low" });
      }
    };
    const idle = "requestIdleCallback" in window ? requestIdleCallback(warm, { timeout: 2000 }) : setTimeout(warm, 1200);
    return () => ("cancelIdleCallback" in window ? cancelIdleCallback(idle as number) : clearTimeout(idle));
  }, [more, slug]);
  const shell: Shell = (p) => (
    <FlowShell
      {...p}
      h1={h1}
      body={
        p.at === 1 ? (
          <>
            {more ? <Tabs at={slug} /> : null}
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
      over
      get={p.at === 1 ? getList(S) : undefined}
      foot={
        p.at === 1 ? (
          <>
            {p.sub ? <p className="f-where">{p.sub}</p> : null}
            {more ? <More on={slug === "consultation"} go={(x) => router.replace(`/book/${x}`, { scroll: false })} /> : null}
          </>
        ) : undefined
      }
    />
  );
  if (!S.cal) return <OnRequest key={slug} slug={slug} shell={shell} />;
  return <CalEmbed key={slug} path={S.cal} title={`Pick a time for ${S.name}`} v3={{ shell, name: S.name, from: S.from }} />;
}

export function V3Book({ slug }: { slug: SessionSlug }) {
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-flow">
        <V3BookFlow slug={slug} h1 />
      </section>
    </div>
  );
}

/* Weddings: Date, Shoot, You, Sent. Nothing is booked; the request is an
   enquiry and the date is confirmed with a quote. */
const noop = () => () => {};

/* Client only: the page is prerendered, so a date baked in at build time
   no longer matches the visitor's today and hydration fails. */
function OnRequest(props: { slug: SessionSlug; shell: Shell }) {
  const stamp = React.useSyncExternalStore(noop, () => new Date().toDateString(), () => "");
  return stamp ? <OnRequestFlow {...props} stamp={stamp} /> : null;
}

function OnRequestFlow({ slug, shell, stamp }: { slug: SessionSlug; shell: Shell; stamp: string }) {
  const S = SESSIONS[slug];
  const { state, pending, sent, send } = useEnquiry();
  const today = React.useMemo(() => new Date(stamp), [stamp]);
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
        if (!v.name.trim()) no.name = "Add your name";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) no.email = "Email looks incomplete";
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
