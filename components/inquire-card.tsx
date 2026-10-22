"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { gsap } from "gsap";
import { ContactForm, INITIAL, fit, submitOrKeep } from "@/components/contact-form";
import { ReferencePicks } from "@/components/reference-picks";
import { trailContext } from "@/components/visit-trail";
import { RESPONSE_TIME } from "@/lib/site";
import { cn } from "@/lib/utils";

/* ── the inquiry, editorial ───────────────────────────────────────
 * The inquiry form in the booking card's page (Julian, 2026-10-21, from
 * the mocks of 10-20): one huge line, hairlines, square boxes. One page
 * (Julian, 2026-10-21, "the 2 step is confusing"): the kinds are six
 * tiles with who each is for, picking one brings its two questions in
 * under it, and the details sit beside them, one Send. Sent after.
 * `?classic` keeps the form before (`contact-form.tsx`), which also
 * still does the sending (`submitOrKeep`).
 * ─────────────────────────────────────────────────────────────── */

const classic = () => typeof location !== "undefined" && new URLSearchParams(location.search).has("classic");
/* The cursor pours into the tiles and buttons, as on the booking card
   (time-picker.tsx); `?goo=0` turns it off. */
const goo = typeof location === "undefined" || new URLSearchParams(location.search).get("goo") !== "0";

/** The kinds, who each is for, and the two questions it opens. */
const KINDS: { value: string; label: string; who: string; asks: [string, string, string, string] }[] = [
  { value: "editorial", label: "Editorial", who: "Magazines, stylists, designers", asks: ["Publication and issue date", "Vogue Italia, March", "Usage and territory", "Print and web, worldwide"] },
  { value: "campaign", label: "Campaign", who: "Brands and agencies", asks: ["The brand and the brief", "A spring drop, three looks", "Runs on and territory", "Social and web, 12 months, US"] },
  { value: "music", label: "Music", who: "Artists, labels, press kits", asks: ["Artist and release", "A single, out in May", "For", "Press, cover art, a video"] },
  { value: "video", label: "Video", who: "Music videos, fashion films, BTS", asks: ["What it is", "A visualizer, about a minute", "Deadline and where it runs", "End of June, YouTube and IG"] },
  { value: "portrait", label: "Portraits", who: "Actors, founders, you", asks: ["Who it is for", "Headshots for an agency", "Roughly when", "Some time in June"] },
  { value: "event", label: "Events", who: "Launches, shows, parties", asks: ["The event and date", "A launch, Oct 24", "Coverage", "Four hours, the room and the guests"] },
];

/** What happens after the send (Julian, 2026-10-21). */
const NEXT = [
  ["We figure out the vision", "A call or a thread. References, mood, talent, where it runs"],
  ["We plan it", "Date, location, crew. You get a quote and the run of show"],
  ["We get to work", "The shoot. Edited selects follow in about a week"],
];

type Props = NonNullable<React.ComponentProps<typeof ContactForm>>;
type Tile = { value: string; label: string; who: string; asks: [string, string, string, string] | null };

export function InquireCard(props: Props) {
  const [old] = React.useState(classic);
  return old ? <ContactForm {...props} /> : <Editorial {...props} />;
}

function Editorial({ defaults, sessions = [] }: Props) {
  const params = useSearchParams();
  const preset = params.get("type") ?? defaults?.type ?? null;
  const presetSession = params.get("session") ?? defaults?.session ?? null;
  const presetRef = params.get("ref") ?? defaults?.ref ?? null;
  /* Book a session landed here (`?type=session`): the tiles are the
     sessions, and the kind goes in as "session". */
  const booking = preset === "session" && sessions.length > 0;
  const tiles: Tile[] = booking ? sessions.map((s) => ({ value: s, label: s, who: "", asks: null })) : KINDS;
  const [kind, setKind] = React.useState(() => (booking ? presetSession ?? "" : tiles.some((t) => t.value === preset) ? preset! : ""));
  const [ask, setAsk] = React.useState(["", ""]);
  const [state, formAction, pending] = React.useActionState(submitOrKeep, INITIAL);
  const root = React.useRef<HTMLFormElement>(null);
  const tile = tiles.find((t) => t.value === kind);
  const values = state.values ?? {};
  /* Dev only, `?sim=sent`: the Sent step without sending (as `?sim` on the deposit). */
  const [sim, setSim] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).get("sim") === "sent") setSim(true);
  }, []);
  const sent = state.status === "sent" || sim;
  const detail = [
    presetRef ? `Similar to ${presetRef}` : "",
    ...(tile?.asks ? [ask[0] && `${tile.asks[0]}: ${ask[0]}`, ask[1] && `${tile.asks[2]}: ${ask[1]}`] : []),
  ].filter(Boolean).join(" · ");
  const side = (tile ? [tile.label, ask[0]].filter(Boolean).join(" · ") : "Editorial, campaigns, cover art and press kits");

  /* The page's pieces cascade in, left to right, row by row, as the
     calendar's days do (time-picker.tsx); a pick brings its questions in
     the same way. */
  const shownKind = React.useRef(kind);
  React.useLayoutEffect(() => {
    const el = root.current;
    const sel = kind !== shownKind.current ? ".ed-ask" : "[data-in]";
    shownKind.current = kind;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = [...el.querySelectorAll<HTMLElement>(sel)];
    const tw = items.map((c, k) => {
      const cols = getComputedStyle(c.parentElement!).gridTemplateColumns.split(" ").length || 1;
      return gsap.fromTo(c, { autoAlpha: 0, y: 10, rotationX: -35, transformPerspective: 500, transformOrigin: "50% 0%" }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.45, delay: (k % cols) * 0.03 + Math.floor(k / cols) * 0.06, ease: "expo.out", clearProps: "opacity,visibility,transform" });
    });
    return () => tw.forEach((t) => t.progress(1).kill());
  }, [kind, sent]);

  const hero = (big: string, small: React.ReactNode, mark: React.ReactNode, act?: React.ReactNode) => (
    <div className="ed-hero">
      <h2>{big}<small>{small}</small></h2>
      <p className="ed-mk"><i />{mark}{act}</p>
    </div>
  );
  const replies = RESPONSE_TIME ? `Replies ${RESPONSE_TIME}` : null;
  const floor = `hello@juliangigola.com${RESPONSE_TIME ? ` · replies ${RESPONSE_TIME}` : ""}`;
  const stick = goo ? "fill" : undefined;

  if (sent) {
    return (
      <div role="status" className="tp ed ed-inq" data-sent>
        {hero("Sent", <>{side}<br />To Julian Gigola</>, "What happens next")}
        <div className="ed-body">
          <div className="ed-nx">
            {NEXT.map(([t, d], i) => (
              <div key={t} className="ed-nx-row" data-in data-on={i === 0 ? "" : undefined}>
                <b>{`0${i + 1}`}</b>
                <span className="ed-nx-t">{t}</span>
                <span className="ed-nx-d">{d}</span>
                <i />
              </div>
            ))}
          </div>
        </div>
        <div className="ed-floor">
          <span className="label">{state.message ?? "Sent. A copy is on its way to you."}</span>
          <Link href="/portfolio" data-stick={stick} className="ed-btn">See the work</Link>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={root}
      action={formAction}
      noValidate
      className="tp ed ed-inq"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const ctx = form.elements.namedItem("context");
        if (ctx instanceof HTMLInputElement) ctx.value = trailContext();
        if (!form.checkValidity()) {
          form.querySelector<HTMLElement>(":invalid")?.focus();
          return;
        }
        const data = new FormData(form);
        React.startTransition(() => formAction(data));
      }}
    >
      {/* The honeypot (`contact-form.tsx`). */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" hidden />
      <input type="hidden" name="context" />
      <input type="hidden" name="type" value={booking ? "session" : kind || "other"} />
      {booking ? <input type="hidden" name="session" value={kind} /> : null}
      {detail ? <input type="hidden" name="detail" value={detail} /> : null}
      {hero("Inquire", <>{side}{replies ? <><br />{replies}</> : null}</>, "The kind of shoot, and who you are")}
      <div className="ed-body">
        <div className="ed-r ed-fields ed-one">
          <div>
            <fieldset className="ed-row ed-kind-row">
              <legend className="label">{booking ? "Which session" : "What kind of shoot"}</legend>
              <div className="ed-kinds">
                {tiles.map((t) => (
                  <label key={t.value} data-stick={stick} data-in>
                    <input type="radio" name="kind" value={t.value} checked={kind === t.value} onChange={() => { setKind(t.value); setAsk(["", ""]); }} className="sr-only" />
                    <span><em>{t.label}</em>{t.who ? <small>{t.who}</small> : null}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {tile?.asks ? (
              <div className="ed-asks" key={tile.value}>
                {[0, 1].map((i) => (
                  <label key={i} className="ed-row ed-ask" data-in>
                    <span className="label">{tile.asks![i * 2]}</span>
                    <input value={ask[i]} onChange={(e) => setAsk(i ? [ask[0], e.target.value] : [e.target.value, ask[1]])} placeholder={tile.asks![i * 2 + 1]} autoComplete="off" />
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <label className="ed-row" data-in><span className="label">Name</span><input name="name" required autoComplete="name" defaultValue={values.name} placeholder="Your name" /></label>
            <label className="ed-row" data-in><span className="label">Email</span><input name="email" type="email" required autoComplete="email" defaultValue={values.email} placeholder="you@studio.com" /></label>
            <label className="ed-row" data-in><span className="label">About the project</span><textarea name="message" required rows={3} defaultValue={values.message} ref={fit} onInput={(e) => fit(e.currentTarget)} placeholder="What it is, where and roughly when" className="tp-notes" /></label>
            <div className="ed-row ed-refs" data-in><ReferencePicks resync={state} /></div>
            {state.status === "error" || state.status === "unconfigured" ? (
              <p role="alert" className={cn("ed-err", state.status !== "error" && "text-muted-foreground")}>
                {state.message}
                {state.mailto ? <> <a href={state.mailto} className="underline underline-offset-4">Open in your mail app</a></> : null}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="ed-floor">
        <span className="label">{floor}</span>
        <button type="submit" data-stick={stick} className="ed-btn" disabled={pending}>{pending ? "Sending" : "Send"}</button>
      </div>
    </form>
  );
}
