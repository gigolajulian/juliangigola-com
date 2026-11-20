"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { matches } from "@/lib/device";
import { QUOTE_CLIENTS, QUOTE_OPTS, type QuoteClient, type QuoteOpt } from "./data";
import { CardsCtx, useTold } from "./ctx";

/* Spec 3.5: quote second. The photo shows the current client's frame until
   the pointer is over the options column or an option is picked; then the
   option's photo. motion/quote.ts runs the client rotation and tells this
   screen which client and name to show. */

/* Weddings is its own last row, below the other options. */
const W = QUOTE_OPTS.findIndex((o) => o.key === "weddings");

/** `on`: client 0 without motion (static CSS). `q`: the rotation's current client (quote.css, only under motion). */
function ClientPhoto({ c, on, q, stills, wide }: { c: QuoteClient; on: boolean; q: boolean; stills: Record<string, string>; wide?: boolean }) {
  const srcs = c.photos.map((p) => ({ ...p, src: stills[p.src] ?? p.src })).filter((p) => p.src);
  if (wide && c.wide) return <span className={on ? "cl on" : "cl"} data-q={q ? "" : undefined}><Image src={c.wide} alt={c.photos[0].alt} fill sizes="100vw" /></span>;
  return (
    <span className={`cl${on ? " on" : ""}${srcs.length > 1 ? " two" : ""}`} data-q={q ? "" : undefined}>
      {srcs.map((p) => (
        <span key={p.src} className="st">
          <Image src={p.src} alt={p.alt} fill sizes="(max-width: 1023px) 100vw, 42vw" />
        </span>
      ))}
    </span>
  );
}

export function MtByQuote({ stills, reply, onOptionPick }: { stills: Record<string, string>; reply: string | null; onOptionPick: (k: QuoteOpt["key"]) => void }) {
  const [sel, setSel] = React.useState(0);
  const [optPhoto, setOptPhoto] = React.useState(false); // the option's photo shows instead of the client's
  const ci = 0; // the first client, for the static form (`.on`)
  // the rotation (motion/quote.ts): `k` is the client shown, `name` the name shown (it follows k after a fade, `sw`)
  const [rot, setRot] = React.useState({ k: 0, name: 0, sw: false });
  const ref = React.useRef<HTMLElement>(null);
  useTold(ref, setRot);
  const sw = rot.sw ? "" : undefined;
  const cards = React.useContext(CardsCtx);
  const o = QUOTE_OPTS[sel];
  const pick = (i: number) => {
    setSel(i);
    setOptPhoto(true);
    onOptionPick(QUOTE_OPTS[i].key);
  };
  const client = QUOTE_CLIENTS[rot.name];
  return (
    <section className="mt-quote" data-mt="quote" data-client={rot.k} data-opt={optPhoto || undefined} ref={ref}>
      <div className="mt-frame mt-stage">
        <figure className="mt-photo">
          {QUOTE_CLIENTS.map((c, i) => <ClientPhoto key={c.name} c={c} on={!optPhoto && i === ci} q={i === rot.k} stills={stills} />)}
          {QUOTE_OPTS.map((x, i) => (
            <span key={x.key} className={optPhoto && i === sel ? "op on" : "op"} data-cur={i === sel || undefined}>
              <Image src={x.photo} alt={`${x.name} sample`} fill sizes="(max-width: 1023px) 100vw, 42vw" />
            </span>
          ))}
          <figcaption className="lbl mt-clcap" aria-hidden data-sw={sw}>{client.name}</figcaption>
        </figure>
        {/* Phone and tablet: the client frame at 2:1 (spec 8). */}
        <figure className="mt-photo-w">
          {QUOTE_CLIENTS.map((c, i) => <ClientPhoto key={c.name} c={c} on={i === ci} q={i === rot.k} stills={stills} wide />)}
        </figure>
        <div className="mt-quote-col" onPointerEnter={() => matches("fine") && setOptPhoto(true)} onPointerLeave={() => matches("fine") && setOptPhoto(false)}>
          <p className="lbl mute mt-label">By quote</p>
          <h2 className="mt-q-h">Have something in mind?</h2>
          <p className="lbl mt-by">
            <span className="mute">Commissioned by</span> <span className="nm" data-sw={sw}>{client.name}</span>
          </p>
          <div className="mt-qos">
            {QUOTE_OPTS.map((x, i) => i === W ? null : (
              <div key={x.key} className="mt-qow" data-on={i === sel || undefined}>
                <button type="button" className="mt-qo" aria-pressed={i === sel} onPointerEnter={() => matches("fine") && pick(i)} onFocus={() => pick(i)} onClick={() => pick(i)}>
                  <b>{x.name}</b>
                  <span className="lbl">{x.holds.map((h, k) => <React.Fragment key={h}>{k ? <i> | </i> : null}{h}</React.Fragment>)}</span>
                </button>
                <p className="mt-qo-d">{x.detail}</p>
              </div>
            ))}
            <button type="button" className="mt-qw" aria-pressed={sel === W} onPointerEnter={() => matches("fine") && pick(W)} onFocus={() => pick(W)} onClick={() => pick(W)}>
              <b>{QUOTE_OPTS[W].name}</b>
              <span><span className="dk">{QUOTE_OPTS[W].holds.join(" | ")}</span><span className="po">Full day | Couples</span></span>
            </button>
          </div>
          <p className="mt-q-line">Send a note or book a free call. I come back with an approach and a quote.</p>
          <div className="mt-q-act">
            <button type="button" className="btn fill mt-big" aria-label={`Inquire about ${o.name.toLowerCase()}`} onClick={() => cards.inquire("quote", o.key)}>Inquire</button>
            <div className="mt-q-alt">
              {reply ? <p className="lbl mute">Replies {reply}</p> : null}
              <Link className="mt-link" href={o.call}>Book a free 15 minute call</Link>
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
