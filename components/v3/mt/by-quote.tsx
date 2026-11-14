"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { QUOTE_CLIENTS, QUOTE_OPTS, type QuoteClient } from "./data";
import { CardsCtx } from "./ctx";

/* Spec 3.5: quote second. The photo shows the current client's frame until
   the pointer is over the options column or an option is picked; then the
   option's photo. The client rotation is the motion pass's (`data-client`). */
const fine = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

function ClientPhoto({ c, on, stills, wide }: { c: QuoteClient; on: boolean; stills: Record<string, string>; wide?: boolean }) {
  const srcs = c.photos.map((p) => ({ ...p, src: stills[p.src] ?? p.src })).filter((p) => p.src);
  if (wide && c.wide) return <span className={on ? "cl on" : "cl"}><Image src={c.wide} alt={c.photos[0].alt} fill sizes="100vw" /></span>;
  return (
    <span className={on ? `cl on${srcs.length > 1 ? " two" : ""}` : `cl${srcs.length > 1 ? " two" : ""}`}>
      {srcs.map((p) => (
        <span key={p.src} className="st">
          <Image src={p.src} alt={p.alt} fill sizes="(max-width: 1023px) 100vw, 42vw" />
        </span>
      ))}
    </span>
  );
}

export function MtByQuote({ stills, reply }: { stills: Record<string, string>; reply: string | null }) {
  const [on, setOn] = React.useState(0);
  const [opt, setOpt] = React.useState(false); // the option's photo shows instead of the client's
  const [ci] = React.useState(0); // hook: the client rotation advances this (MOTION-HOOKS.md)
  const cards = React.useContext(CardsCtx);
  const o = QUOTE_OPTS[on];
  const pick = (i: number) => {
    setOn(i);
    setOpt(true);
  };
  // desktop hold: scroll steps from the clients (-1) through the four options (motion/quote.ts)
  const sec = React.useRef<HTMLElement>(null);
  const step = React.useRef(-1);
  React.useEffect(() => {
    const el = sec.current!;
    const on = (e: Event) => {
      const i = (e as CustomEvent<number>).detail;
      step.current = i;
      if (i < 0) setOpt(false);
      else pick(i);
    };
    el.addEventListener("mt-step", on);
    return () => el.removeEventListener("mt-step", on);
  }, []);
  const rest = () => {
    if (step.current < 0) setOpt(false);
    else pick(step.current);
  };
  const client = QUOTE_CLIENTS[ci];
  return (
    <section className="mt-quote" data-mt="quote" data-hold="1.6" data-client={ci} data-opt={opt || undefined} ref={sec}>
      <div className="mt-frame mt-stage">
        <figure className="mt-photo">
          {QUOTE_CLIENTS.map((c, i) => <ClientPhoto key={c.name} c={c} on={!opt && i === ci} stills={stills} />)}
          {QUOTE_OPTS.map((x, i) => (
            <span key={x.key} className={opt && i === on ? "op on" : "op"}>
              <Image src={x.photo} alt={`${x.name} sample`} fill sizes="(max-width: 1023px) 100vw, 42vw" />
            </span>
          ))}
          <figcaption className="lbl mt-clcap" aria-hidden>{client.name}</figcaption>
        </figure>
        {/* Phone and tablet: the client frame at 2:1 (spec 8). */}
        <figure className="mt-photo-w">
          {QUOTE_CLIENTS.map((c, i) => <ClientPhoto key={c.name} c={c} on={i === ci} stills={stills} wide />)}
        </figure>
        <div className="mt-quote-col" onPointerEnter={() => fine() && setOpt(true)} onPointerLeave={() => fine() && rest()}>
          <p className="lbl mute mt-label">By quote</p>
          <h2 className="mt-q-h">Have something in mind?</h2>
          <p className="lbl mt-by">
            <span className="mute">Commissioned by</span> <span className="nm" aria-live="off">{client.name}</span>
          </p>
          <div className="mt-qos">
            {QUOTE_OPTS.slice(0, 3).map((x, i) => (
              <div key={x.key} className="mt-qow" data-on={i === on || undefined}>
                <button type="button" className="mt-qo" aria-pressed={i === on} onPointerEnter={() => fine() && pick(i)} onFocus={() => pick(i)} onClick={() => pick(i)}>
                  <b>{x.name}</b>
                  <span className="lbl">{x.holds.map((h, k) => <React.Fragment key={h}>{k ? <i> | </i> : null}{h}</React.Fragment>)}</span>
                </button>
                <p className="mt-qo-d">{x.detail}</p>
              </div>
            ))}
            <button type="button" className="mt-qw" aria-pressed={on === 3} onPointerEnter={() => fine() && pick(3)} onFocus={() => pick(3)} onClick={() => pick(3)}>
              <b>Weddings</b>
              <span><span className="dk">Full day | Couples, engagements</span><span className="po">Full day | Couples</span></span>
            </button>
          </div>
          <p className="mt-q-line">Send a note or book a free call. I come back with an approach and a quote.</p>
          <div className="mt-q-act">
            <button type="button" className="btn fill mt-big" onClick={() => cards.inquire("quote", o.key)}>Inquire about {o.name.toLowerCase()}</button>
            <div className="mt-q-alt">
              <Link className="mt-link" href={o.call}>Or book a free 15 minute call</Link>
              {reply ? <p className="lbl mute">Replies {reply}</p> : null}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-bar">
        <Link className="lbl mt-bar-call" href={o.call}><span>Free consultation&nbsp;<span aria-hidden>&rarr;</span></span></Link>
        {/* the picked row above names the session; the label keeps it for screen readers */}
        <button type="button" className="btn fill" aria-label={`Inquire about ${o.name.toLowerCase()}`} onClick={() => cards.inquire("quote", o.key)}>Inquire</button>
      </div>
    </section>
  );
}
