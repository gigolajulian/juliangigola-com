"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoverNav, V3Foot } from "@/components/v3/chrome";
import { Duo, Marks, Pick } from "@/components/v3/duo";
import { COMMISSIONS, COMMISSION_TABS, DOORS, HERO, HERO_ALT, INDEX_ORDER, RECENT, SESSIONS, rate } from "@/lib/v3";

/* JG V3 homepage (master v39, section A): hero crossfade, logo strip,
   Recent work, Commissions sheet, Sessions index, the two doors. */

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Hero: four frames, a 1.2s crossfade every 6s; the ticks pick one. */
function Hero() {
  const [i, setI] = React.useState(0);
  const [round, setRound] = React.useState(0);
  React.useEffect(() => {
    if (calm()) return;
    const t = setInterval(() => setI((n) => (n + 1) % HERO.length), 6000);
    return () => clearInterval(t);
  }, [round]);
  const pick = (n: number) => {
    setI(n);
    setRound((r) => r + 1);
  };
  return (
    <div className="a-cover">
      <div className="slides">
        {HERO.map((s, n) => (
          <Duo key={n} d={s.d.src} l={s.l.src} alt={HERO_ALT[n]} altL={s.l.name} sizes="100vw" priority={n === 0} className={n === i ? "on" : undefined} />
        ))}
      </div>
      <CoverNav />
      <div className="foot">
        <div>
          <h1>Julian Gigola</h1>
          <div className="lbl">Photographer and creative director | San Francisco Bay Area</div>
        </div>
        <div className="right">
          <div className="lbl" style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span>
              {String(i + 1).padStart(2, "0")} | <Pick d={HERO[i].d.name} l={HERO[i].l.name} />
            </span>
            <span className="ticks">
              {HERO.map((_, n) => (
                <button key={n} type="button" className={n === i ? "on" : undefined} aria-label={`Frame ${n + 1}`} onClick={() => pick(n)} />
              ))}
            </span>
          </div>
          <div className="ctas">
            <Link className="btn fill" href="/contact/form">Inquire</Link>
            <Link className="btn" href="/book">Book a session</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Logo strip: still until scroll, then maps A to B over the hero's height,
   eased (lerp 0.06), no clamp. A tracks WIRED's right edge at 56.38% of the
   strip; B is 538px to its right (tuned at 1440: A -347, B 191). */
function Clients() {
  const mq = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const box = mq.current!;
    const tr = box.firstElementChild as HTMLElement;
    const band = box.closest(".clients") as HTMLElement;
    const wired = tr.querySelector('[data-mk="wired-magazine"]')!;
    const T = { a: 0, b: 0 };
    let cur: number | null = null;
    let running = false;
    let raf = 0;
    const still = calm();
    const fit = () => {
      T.a = Math.round(box.clientWidth * 0.5638 - (wired.getBoundingClientRect().right - tr.getBoundingClientRect().left));
      T.b = T.a + 538;
    };
    const goal = () => (still ? T.a : T.a + (T.b - T.a) * Math.max(0, scrollY / (band.offsetTop + band.offsetHeight)));
    const draw = () => {
      const g = goal();
      cur = cur === null ? g : cur + (g - cur) * 0.06;
      const half = tr.scrollWidth / 2;
      const x = -((((-cur) % half) + half) % half);
      tr.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      running = Math.abs(g - cur) > 0.1;
      if (running) raf = requestAnimationFrame(draw);
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    };
    const refit = () => {
      fit();
      cur = null;
      draw();
    };
    fit();
    draw();
    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", refit);
    addEventListener("load", refit);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", kick);
      removeEventListener("resize", refit);
      removeEventListener("load", refit);
    };
  }, []);
  return (
    <div className="clients lbl">
      <span className="mute">Published and commissioned by</span>
      <div className="mq" ref={mq}>
        <div className="mq-track">
          <Marks />
          <Marks hidden />
        </div>
      </div>
    </div>
  );
}

/* Recent work: three columns, a smooth lerp parallax clamped to ±56px. */
function Recent() {
  const seq = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (calm()) return;
    const el = seq.current!;
    const cols = [...el.querySelectorAll<HTMLElement>(".col")];
    const cur = cols.map(() => 0);
    let running = false;
    let raf = 0;
    const draw = () => {
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2 - innerHeight / 2;
      let moving = false;
      cols.forEach((c, i) => {
        const t = Math.max(-56, Math.min(56, mid * +c.dataset.speed!));
        cur[i] += (t - cur[i]) * 0.08;
        if (Math.abs(t - cur[i]) > 0.05) moving = true;
        else cur[i] = t;
        c.style.transform = `translate3d(0, ${cur[i].toFixed(2)}px, 0)`;
      });
      running = moving;
      if (moving) raf = requestAnimationFrame(draw);
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    };
    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", kick);
    kick();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", kick);
      removeEventListener("resize", kick);
    };
  }, []);
  return (
    <>
      <div className="b-head seq-head">
        <div>
          <h2>Recent work</h2>
          <p className="lbl mute" style={{ margin: "14px 0 0" }}>
            From concept to final frame. <span className="m-line">Six disciplines, one eye.</span>
          </p>
        </div>
        <Link className="btn" href="/portfolio">See the work</Link>
      </div>
      <div className="a-seq" ref={seq}>
        {RECENT.map((c, k) => (
          <div className="col" data-speed={c.speed} key={k}>
            {c.shots.map((s, n) => (
              <figure key={n}>
                <div className="ph">
                  <Duo d={s.d.src} l={s.l.src} alt={s.d.name} altL={s.l.name} sizes="(max-width: 700px) 50vw, 30vw" />
                </div>
                <figcaption className="lbl">
                  <span className="nm"><Pick d={s.d.name} l={s.l.name} /></span>
                  <span className="mute"><Pick d={s.d.meta!} l={s.l.meta!} /></span>
                </figcaption>
              </figure>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function Commissions({ count }: { count: number }) {
  const tabs = React.useRef<HTMLDivElement>(null);
  const bar = React.useRef<HTMLDivElement>(null);
  /* The tabs' drawn scrollbar: only when they overflow. */
  React.useEffect(() => {
    const t = tabs.current!;
    const b = bar.current!;
    const th = b.firstElementChild as HTMLElement;
    const sync = () => {
      const over = t.scrollWidth - t.clientWidth > 2;
      b.hidden = !over;
      if (!over) return;
      const w = b.clientWidth;
      const tw = Math.max(24, (w * t.clientWidth) / t.scrollWidth);
      th.style.width = `${tw}px`;
      th.style.transform = `translateX(${((w - tw) * t.scrollLeft) / (t.scrollWidth - t.clientWidth)}px)`;
    };
    t.addEventListener("scroll", sync, { passive: true });
    addEventListener("resize", sync);
    sync();
    return () => {
      t.removeEventListener("scroll", sync);
      removeEventListener("resize", sync);
    };
  }, []);
  return (
    <>
      <div className="b-head">
        <h2>Commissions</h2>
        <Link className="btn" href="/portfolio">See all {count} projects</Link>
      </div>
      {/* Focusable so the row scrolls from the keyboard too (axe). */}
      <div className="tabs lbl" ref={tabs} tabIndex={0} aria-label="Disciplines">
        {COMMISSION_TABS.map((t, n) => (
          <span key={t} className={n === 0 ? "on" : undefined}>{t}</span>
        ))}
      </div>
      <div className="tabs-bar" ref={bar} hidden>
        <i />
      </div>
      <div className="sheet">
        {COMMISSIONS.map((s, n) => (
          <figure key={n}>
            <Duo d={s.d.src} l={s.l.src} alt={s.d.name} altL={s.l.name} sizes={n === 0 ? "(max-width: 700px) 100vw, 50vw" : "(max-width: 700px) 50vw, 25vw"} />
            <figcaption className="lbl">
              <span>
                {String(n + 1).padStart(2, "0")} <span className="nm"><Pick d={s.d.name} l={s.l.name} /></span>
              </span>
              {s.d.meta ? <span className="mute"><Pick d={s.d.meta} l={s.l.meta!} /></span> : null}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="sheet-gap" style={{ height: 96 }} />
    </>
  );
}

/* Sessions index: pointing at a row brings its photo up; a click books it. */
function SessionsIndex() {
  const [on, setOn] = React.useState(INDEX_ORDER[0]);
  const router = useRouter();
  return (
    <div className="a-index" id="sessions">
      <div>
        <div className="sess-head">
          <h2>Sessions</h2>
          <p className="lbl mute">Book a shoot</p>
        </div>
        <div className="list">
          {INDEX_ORDER.map((slug, n) => {
            const s = SESSIONS[slug];
            return (
              <button
                key={slug}
                type="button"
                className={slug === on ? "row on" : "row"}
                onPointerEnter={() => setOn(slug)}
                onFocus={() => setOn(slug)}
                onClick={() => router.push(`/book/${slug}`)}
              >
                <span className="n lbl">{String(n + 1).padStart(2, "0")}</span>
                <span className="t">{s.name}</span>
                <span className="p lbl">{rate(s)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="frame" style={{ margin: 0 }}>
        <figure style={{ margin: 0, height: "100%", position: "relative" }}>
          {INDEX_ORDER.map((slug) => (
            <Duo key={slug} d={SESSIONS[slug].photo.d} l={SESSIONS[slug].photo.l} alt={`${SESSIONS[slug].name} sample`} sizes="(max-width: 800px) 100vw, 44vw" className={slug === on ? "on" : "off"} />
          ))}
        </figure>
      </div>
    </div>
  );
}

export function Doors() {
  return (
    <div className="doors">
      <div className="door">
        <Duo d={DOORS.commissions.d} l={DOORS.commissions.l} alt="" sizes="(max-width: 800px) 100vw, 50vw" />
        <span className="lbl mute">For art directors and artists</span>
        <h3>Have something in mind?</h3>
        <p>Campaigns, editorial, cover art and presskits. Tell me what you have in mind and I&apos;ll come back with an approach and a quote.</p>
        <div>
          <Link className="btn fill" href="/contact/form">Inquire</Link>
        </div>
      </div>
      <div className="door">
        <Duo d={DOORS.book.d} l={DOORS.book.l} alt="" sizes="(max-width: 800px) 100vw, 50vw" />
        <span className="lbl mute">For private clients</span>
        <h3>Book a session</h3>
        <ul className="lbl">
          {INDEX_ORDER.map((slug) => (
            <li key={slug}>
              <Link href={`/book/${slug}`}>
                {SESSIONS[slug].name}
                <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function V3Home({ count }: { count: number }) {
  return (
    <section className="v3 v3home">
      <Hero />
      <Clients />
      <Recent />
      <Commissions count={count} />
      <SessionsIndex />
      <Doors />
      <V3Foot />
    </section>
  );
}
