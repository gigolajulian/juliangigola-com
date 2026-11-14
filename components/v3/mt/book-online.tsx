"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Duo } from "@/components/v3/duo";
import { SESSIONS } from "@/lib/v3";
import { BOOK_ROWS, gradYear, type BookRow } from "./data";
import { useNextOpen } from "./next-open";
import { CardsCtx } from "./ctx";

/* Spec 3.4: paid first. A row is picked by hover (fine pointers), focus or
   tap; the photo, the detail line and the Book block follow it. */
const fine = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
const DETAILS: Partial<Record<BookRow["key"], string>> = { portraits: "/portraits", headshots: "/headshots", graduation: "/graduation-photos", "studio-digitals": "/model-digitals" };
const TEAM = "Booking a team? Ask for a day rate.";

export const detailOf = (r: BookRow) => r.detail.replace("{year}", String(gradYear()));

export function RowPhoto({ r, on, sizes }: { r: BookRow; on: boolean; sizes: string }) {
  const style = { objectPosition: r.at } as React.CSSProperties;
  const cls = on ? "on" : undefined;
  if (!r.slug) return <Image src={r.photo} alt={`${r.name} sample`} fill sizes={sizes} className={cls} style={style} />;
  const p = SESSIONS[r.slug].photo;
  return (
    <span className={on ? "duo on" : "duo"} style={{ "--at": r.at } as React.CSSProperties}>
      <Duo d={p.d} l={p.l} alt={`${r.name} sample`} sizes={sizes} />
    </span>
  );
}

export function MtBookOnline() {
  const [on, setOn] = React.useState(0);
  const cards = React.useContext(CardsCtx);
  const r = BOOK_ROWS[on];
  const next = useNextOpen(r.slug);
  const when = [next && `Next open ${next}`, r.ready && `Ready in ${r.ready}`].filter(Boolean).join(" | ");
  const row = (x: BookRow) => {
    const i = BOOK_ROWS.indexOf(x);
    return (
      <div key={x.key} className="mt-brw" data-on={i === on || undefined}>
        <button type="button" className="mt-br" aria-pressed={i === on} onPointerEnter={() => fine() && setOn(i)} onFocus={() => setOn(i)} onClick={() => setOn(i)}>
          <b>{x.name}</b>
          <span className="lbl">
            {x.len} <i>|</i> <span className="w">{x.what} <i>|</i> </span>
            {x.price}
          </span>
        </button>
        {/* Phone: the tapped row opens its line under it. */}
        <p className="mt-br-d">
          {detailOf(x)}
          {x.ready ? ` Ready in ${x.ready}.` : ""}
        </p>
      </div>
    );
  };
  return (
    <section className="mt-book" data-mt="book" data-on={r.key}>
      <div className="mt-frame">
        <p className="lbl mute mt-label">Book online</p>
        <div className="mt-book-col">
          <p className="lbl mt-group">
            <span>Sessions</span>
            <span className="mute">Pick a time online.</span>
          </p>
          <div className="mt-brs">{BOOK_ROWS.filter((x) => x.group === "s").map(row)}</div>
          <p className="lbl mt-group mt-group2">
            <span>Agency ready</span>
            <span className="mute"><span className="dk">What agencies ask for, shot to spec.</span><span className="po">Shot to spec.</span></span>
          </p>
          <div className="mt-brs pair">{BOOK_ROWS.filter((x) => x.group === "a").map(row)}</div>
          <div className="mt-block" key={r.key}>
            <p className="mt-detail">
              {detailOf(r).replace(` ${TEAM}`, "")}
              {r.key === "headshots" ? (
                <>
                  {" "}
                  <button type="button" className="mt-inline" onClick={() => cards.inquire("quote", "commercial")}>{TEAM}</button>
                </>
              ) : null}
            </p>
            <div className="mt-act">
              <button type="button" className="btn fill mt-big" onClick={() => cards.book(r.key)}>{r.btn}</button>
              {DETAILS[r.key] ? <Link className="mt-link" href={DETAILS[r.key]!}>Details</Link> : null}
              {when ? <p className="lbl mute mt-when">{when}</p> : null}
            </div>
          </div>
          <p className="lbl mute mt-dep">$100 secures your date and goes toward your balance.</p>
        </div>
        <figure className="mt-photo" aria-live="off">
          {BOOK_ROWS.map((x, i) => <RowPhoto key={x.key} r={x} on={i === on} sizes="(max-width: 1023px) 100vw, 42vw" />)}
        </figure>
      </div>
      {/* Phone, tablet and on its side: the held bar while the screen is up. */}
      <div className="mt-bar">
        <p className="lbl mute">{next ? <>Next open<br />{next}</> : r.ready ? <>Ready in<br />{r.ready}</> : null}</p>
        <button type="button" className="btn fill" onClick={() => cards.book(r.key)}>{r.btn}</button>
      </div>
    </section>
  );
}
