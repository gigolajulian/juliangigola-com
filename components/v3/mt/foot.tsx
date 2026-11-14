"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { BOOK_ROWS, QUOTE_OPTS } from "./data";
import { CardsCtx } from "./ctx";
import { scrollTop } from "@/components/v3/smooth-scroll";

/* Spec 3.10: HomeFoot. Four link columns, the "Contact me" phrase (a
   button that opens the inquiry card), the wall of work behind under its
   scrim. Static: no reveal, drift, lean, spot or lift (MOTION-HOOKS.md). */
const PHRASE = "Contact me";
type Wall = { src: string; slug: string; name: string }[];

/** One frame per project from /canvas.json, fetched when the footer nears. */
function useWall(ref: React.RefObject<HTMLElement | null>) {
  const [wall, setWall] = React.useState<Wall>([]);
  React.useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        fetch("/canvas.json")
          .then((r) => r.json())
          .then((j: Record<string, [string, number, string, string][]>) =>
            setWall(Object.entries(j).flatMap(([slug, f]) => (f[0] ? [{ src: f[0][0], slug, name: f[0][2] }] : []))),
          )
          .catch(() => {});
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(ref.current!);
    return () => io.disconnect();
  }, [ref]);
  return wall;
}

/** How many wall columns cover the screen at 162 design units each. */
function useCols() {
  const [n, setN] = React.useState(9);
  React.useEffect(() => {
    const fit = () => {
      const u = Math.min(1.6, Math.max(0.7, Math.min(innerWidth / 1440, innerHeight / 900)));
      setN(Math.max(9, Math.ceil(innerWidth / (162 * u)) + 1));
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, []);
  return n;
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
  const root = React.useRef<HTMLElement>(null);
  const wall = useWall(root);
  const cols = useCols();
  const year = new Date().getFullYear();
  const per = 6;
  return (
    <footer className="mt-foot" data-mt="foot" data-hold="1" ref={root}>
      <div className="mt-stage">
        <div className="mt-fwall" aria-hidden>
          {wall.length
            ? Array.from({ length: cols }, (_, c) => (
                <div key={c} className="mt-fcol" data-col={c} style={{ "--c": c } as React.CSSProperties}>
                  {Array.from({ length: per }, (_, r) => {
                    const f = wall[(c * per + r) % wall.length];
                    return (
                      <figure key={r} data-slug={f.slug} data-name={f.name}>
                        <Image src={f.src} alt="" fill sizes="160px" />
                      </figure>
                    );
                  })}
                </div>
              ))
            : null}
        </div>
        {/* Phone: the wall as one sideways row under the links. */}
        <div className="mt-frow" aria-hidden>
          {wall.slice(0, 16).map((f) => (
            <figure key={f.slug} data-slug={f.slug} data-name={f.name}>
              <Image src={f.src} alt="" fill sizes="132px" />
            </figure>
          ))}
        </div>
        <div className="mt-fscrim" aria-hidden />
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
            <p><a href="mailto:hello@juliangigola.com">hello@juliangigola.com</a></p>
            <p><a href="https://instagram.com/juliangigola" rel="noopener">Instagram @juliangigola</a></p>
            <p className="mute mt-based">Based</p>
            <p><span className="dk">San Francisco Bay Area</span><span className="po">SF Bay Area</span></p>
          </div>
        </nav>
        <div className="mt-phrase">
          <button type="button" className="mt-ph-btn" aria-label="Contact me, opens the inquiry card" onClick={() => cards.inquire("footer")}>
            <span className="mt-ph-row">
              <Phrase />
              <Phrase copy />
              <Phrase copy />
            </span>
          </button>
        </div>
        <div className="mt-fline lbl mute">
          <span>&copy; {year} Julian Gigola</span>
          <Link href="/legal" className="dk">Legal</Link>
          <button type="button" className="po" onClick={() => scrollTop()}>Top <span aria-hidden>&uarr;</span></button>
        </div>
      </div>
    </footer>
  );
}
