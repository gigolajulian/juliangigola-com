"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { BOOK_ROWS, QUOTE_OPTS } from "./data";
import { CardsCtx } from "./ctx";
import { scrollTop } from "@/components/v3/smooth-scroll";

/* Spec 3.10: HomeFoot. Four link columns, the "Contact me" phrase (a
   button that opens the inquiry card), one still of work behind under its
   scrim. Motion lives in motion/foot.ts. */
const PHRASE = "Contact me";
const STILL = "/work/diesel/03.jpg";
const EVERY = 5000;

/** The still behind the footer and the one after it. The list is one landscape
    frame per project from /canvas.json (a tall frame crops badly in a wide
    footer), fetched when the still first shows; it changes every 5s while it
    is on screen. Phones hide the still, so nothing is fetched there. */
function useStills(ref: React.RefObject<HTMLElement | null>) {
  const [list, setList] = React.useState([STILL]);
  const [i, setI] = React.useState(0);
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    let asked = false;
    const io = new IntersectionObserver(([e]) => {
      setOn(e.isIntersecting);
      if (!e.isIntersecting || asked) return;
      asked = true;
      fetch("/canvas.json")
        .then((r) => r.json())
        .then((j: Record<string, [string, number][]>) => {
          const wide = Object.values(j).flatMap((fr) => fr.find((x) => x[1] < 0.9)?.[0] ?? []);
          setList([STILL, ...wide.filter((src) => !src.startsWith("/work/diesel/"))]);
        })
        .catch(() => {});
    });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, [ref]);
  React.useEffect(() => {
    if (!on || list.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % list.length), EVERY);
    return () => clearInterval(t);
  }, [on, list.length]);
  return list.length < 2 ? [list[0]] : [list[i], list[(i + 1) % list.length]];
}

/** My local time (f2), to the minute. Empty until mounted, so the server and the first paint agree. */
function useLocalTime() {
  const [t, setT] = React.useState("");
  React.useEffect(() => {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    const set = () => setT(f.format(new Date()));
    set();
    const id = setInterval(set, 30000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function Phrase({ copy }: { copy?: boolean }) {
  return (
    <span className="mt-ph" aria-hidden={copy || undefined} data-copy={copy || undefined}>
      {[...PHRASE].map((ch, j) => <span key={j} style={{ "--j": j } as React.CSSProperties}>{ch === " " ? " " : ch}</span>)}
    </span>
  );
}

export function MtFoot() {
  const cards = React.useContext(CardsCtx);
  const wall = React.useRef<HTMLDivElement>(null);
  const stills = useStills(wall);
  const year = new Date().getFullYear();
  const time = useLocalTime();
  /* Which letter is under the pointer: the cover letter there opens all the way, the next one each side partway,
     the one after a little, the rest stay shut (`--d` 0 to 3, mtscroll.css). Steps a letter wide, no gradient. */
  const near = (e: React.PointerEvent<HTMLButtonElement>) => {
    const stage = e.currentTarget.closest(".mt-stage")!;
    const k = e.type === "pointerleave" ? -1 : [...e.currentTarget.querySelectorAll(".mt-ph > span")].indexOf((e.target as Element).closest(".mt-ph > span")!);
    if (k < 0 && e.type !== "pointerleave") return;
    stage.querySelectorAll<HTMLElement>(".mt-ph-top .mt-ph > span").forEach((s, i) => (k < 0 ? s.style.removeProperty("--d") : s.style.setProperty("--d", String(Math.min(3, Math.abs(i - k))))));
  };
  return (
    <footer className="mt-foot" data-mt="foot">
      <div className="mt-stage">
        {/* one still behind the links, dimmed by the scrim (Julian picked this over the wall of frames, 2026-11-14).
            The next still sits under it unseen, so it is loaded by the time it shows. */}
        <div className="mt-fwall" aria-hidden ref={wall}>
          {stills.map((src, n) => <Image key={src} src={src} alt="" fill sizes="100vw" style={n ? { opacity: 0 } : undefined} />)}
        </div>
        {/* shortcut: the phone photo row is gone (Julian, 2026-11-14) but motion/foot.ts still asks for this node; drop both when the desktop wall is replaced */}
        <div className="mt-frow" aria-hidden />
        {/* under the cutout group: the letters' own colour at rest, nearly gone while the phrase is pointed at */}
        <div className="mt-fveil" aria-hidden />
        <nav className="mt-fcols lbl" aria-label="Footer">
          <div>
            <p className="mute">Inquire</p>
            {QUOTE_OPTS.map((o) => (
              <p key={o.key}><button type="button" onClick={() => cards.inquire("quote", o.key)}>{o.name}</button></p>
            ))}
          </div>
          <div>
            <p className="mute">Book online</p>
            {BOOK_ROWS.map((r) => (
              <p key={r.key}><button type="button" onClick={() => cards.book(r.key)}>{r.name}</button></p>
            ))}
          </div>
          <div>
            <p className="mute">Pages</p>
            <p><Link href="/portfolio">Portfolio</Link></p>
            <p><Link href="/book">Sessions</Link></p>
            <p><Link href="/about">About</Link></p>
          </div>
          <div>
            <p className="mute">Reach</p>
            <p><a href="mailto:hello@juliangigola.com"><span className="dk">hello@juliangigola.com</span><span className="po">Email me</span></a></p>
            <p><a href="https://instagram.com/juliangigola" rel="noopener"><span className="dk">Instagram&nbsp;</span>@juliangigola</a></p>
            <p className="mute mt-based">Based</p>
            <p><span className="dk">San Francisco Bay Area</span><span className="po">SF Bay Area</span></p>
          </div>
        </nav>
        {/* the ground and the phrase are one group, blended onto the still, so the letters can open onto it (desktop) */}
        <div className="mt-fknock">
        <div className="mt-fscrim" aria-hidden />
        <div className="mt-phrase">
          <button type="button" className="mt-ph-btn" aria-label="Contact me, opens the inquiry card" onClick={() => cards.inquire("footer")} onPointerOver={near} onPointerLeave={near}>
            <span className="mt-ph-row">
              <Phrase />
              <Phrase copy />
              <Phrase copy />
            </span>
          </button>
        </div>
        </div>
        {/* a cover copy of the phrase in the letters' grey, over the cutout: each letter lifts by how near the pointer is */}
        <div className="mt-phrase mt-ph-top" aria-hidden>
          <span className="mt-ph-row">
            <Phrase />
            <Phrase copy />
            <Phrase copy />
          </span>
        </div>
        <div className="mt-fline lbl mute">
          <span>&copy; {year} Julian Gigola</span>
          {time ? <span className="mt-ftime"><span className="dk">San Jose </span><span className="t">{time}</span></span> : null}
          <Link href="/legal" className="dk">Legal</Link>
          <button type="button" className="po" onClick={() => scrollTop()}>Top <span aria-hidden>&uarr;</span></button>
        </div>
      </div>
    </footer>
  );
}
