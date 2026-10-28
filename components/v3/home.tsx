"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoverNav, V3Foot } from "@/components/v3/chrome";
import { Duo, Marks, Pick } from "@/components/v3/duo";
import { shiftScroll } from "@/components/v3/smooth-scroll";
import { COMMISSIONS, COMMISSION_TABS, DOORS, HERO, HERO_ALT, INDEX_ORDER, RECENT, SESSIONS, rate, type SessionSlug } from "@/lib/v3";

/* JG V3 homepage (master v39, section A): hero crossfade, logo strip,
   Recent work, Commissions sheet, Sessions index, the two doors. */

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Hero: four frames, a 1.2s crossfade every 6s; the ticks pick one. */
function Hero() {
  const [i, setI] = React.useState(0);
  const [round, setRound] = React.useState(0);
  React.useEffect(() => {
    if (calm()) return;
    /* `?splash=sand` and `?splash=burst` land on the first frame, so the turning waits for them. */
    const root = document.documentElement;
    let t: ReturnType<typeof setInterval> | undefined;
    const go = () => (t = setInterval(() => setI((n) => (n + 1) % HERO.length), 6000));
    if (!["sand", "burst"].includes(root.dataset.splash ?? "") || !root.hasAttribute("data-intro")) go();
    const mo = new MutationObserver(() => {
      if (!t && !root.hasAttribute("data-intro")) go();
    });
    if (!t) mo.observe(root, { attributeFilter: ["data-intro"] });
    return () => {
      mo.disconnect();
      clearInterval(t);
    };
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
          <div className="lbl">Photographer and creative director<span className="lbl-sep"> | </span><span className="lbl-place">San Francisco Bay Area</span></div>
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

/* Logo strip: one slow, constant loop (Julian, 2026-10-24: "make them go
   in a loop"; it used to follow the scroll), and a swipe or a trackpad
   drag scrubs it either way ("swipe left and right to see the rest").
   The set runs twice and the position wraps by one set, so the seam never
   shows. A finger holds it; on release it carries the throw and eases
   back to the drift from wherever it stopped. Only sideways intent is
   taken: `touch-action: pan-y` (v3.css) leaves the page's own scroll to
   the browser. No drift under Reduce Motion; the swipe still works. */
const DRIFT = 40; // px per second, leftward
function Clients() {
  const mq = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const box = mq.current!;
    const tr = box.firstElementChild as HTMLElement;
    const drift = calm() ? 0 : DRIFT;
    let x = 0;
    let v = drift; // px/s, positive moves the logos left
    let held = false;
    let last = 0;
    let raf = 0;
    // The loop's width, measured when it changes rather than every frame.
    let half = 1;
    let seen = false;
    const paint = () => {
      x = ((x % half) + half) % half;
      tr.style.transform = `translate3d(${(-x).toFixed(2)}px,0,0)`;
    };
    // Runs only while on screen and moving: drifting, held, or a throw settling.
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      if (!held) {
        x += v * dt;
        // A throw settles back to the drift, about a second.
        v = drift + (v - drift) * Math.exp(-dt * 3);
      }
      paint();
      raf = seen && (held || Math.abs(v) > 0.5) ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (raf || !seen) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    /* Never the same logo twice on screen (Julian, 2026-10-27): on a strip
       wider than the set, the gap grows until one set is longer than the
       strip plus its widest logo, so a copy can't come in before its
       original has gone. */
    const base = parseFloat(getComputedStyle(tr).columnGap) || 0;
    const ro = new ResizeObserver(() => {
      const kids = [...tr.children] as HTMLElement[];
      const n = kids.length / 2;
      const ws = kids.slice(0, n).map((k) => k.getBoundingClientRect().width);
      const sum = ws.reduce((a, w) => a + w, 0);
      const gap = Math.max(base, Math.ceil((box.clientWidth + Math.max(0, ...ws) - sum) / Math.max(1, n - 1)));
      if (Math.abs(parseFloat(tr.style.columnGap || "0") - gap) > 0.5) {
        tr.style.columnGap = `${gap}px`;
        tr.style.paddingRight = `${gap}px`;
      }
      half = tr.scrollWidth / 2 || 1;
      paint();
    });
    ro.observe(tr);
    ro.observe(box);
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      wake();
    });
    io.observe(box);

    let id = -1;
    let px = 0;
    let pt = 0;
    let sx = 0;
    let dragged = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      id = e.pointerId;
      px = sx = e.clientX;
      pt = e.timeStamp;
      dragged = false;
      held = true;
      v = 0;
      wake();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - px;
      const dt = Math.max(1, e.timeStamp - pt) / 1000;
      x -= dx;
      v = -dx / dt;
      px = e.clientX;
      pt = e.timeStamp;
      // Past a tap's jitter it is a drag: capture, and the logo under it does not open.
      if (!dragged && Math.abs(e.clientX - sx) > 6) {
        dragged = true;
        box.setPointerCapture?.(id);
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      held = false;
      // A finger that stopped before lifting throws nothing.
      if (e.timeStamp - pt > 80) v = drift;
      v = Math.max(-3000, Math.min(3000, v));
      wake();
    };
    // Trackpads: a sideways two-finger swipe scrubs; a vertical one scrolls the page.
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      x += e.deltaX;
      paint();
    };
    box.addEventListener("pointerdown", down);
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
    box.addEventListener("wheel", wheel, { passive: false });
    const click = (e: MouseEvent) => {
      if (dragged) e.preventDefault();
    };
    box.addEventListener("click", click, true);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      box.removeEventListener("pointerdown", down);
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", up);
      box.removeEventListener("pointercancel", up);
      box.removeEventListener("wheel", wheel);
      box.removeEventListener("click", click, true);
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
            {/* Phones run two columns: the third column's pair joins the
                first two, one frame each (v3.css hides it there and shows
                these), so neither column waits on the other. */}
            {[...c.shots.map((s) => ({ s, m: false })), ...(k < 2 && RECENT[2] ? [{ s: RECENT[2].shots[k], m: true }] : [])].map(({ s, m }, n) => (
              <figure key={n} className={m ? "m-only" : undefined}>
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

function Commissions() {
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
        <Link className="btn" href="/portfolio">See all projects</Link>
      </div>
      {/* Focusable so the row scrolls from the keyboard too (axe). */}
      <div className="tabs lbl" ref={tabs} tabIndex={0} aria-label="Disciplines">
        {COMMISSION_TABS.map(([t, href], n) => (
          <Link key={t} href={href} className={n === 0 ? "on" : undefined}>{t}</Link>
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
            {/* The frame opens its project; the theme hides the other one's link. */}
            <Link className="v3d tile" href={`/portfolio/${s.d.src.split("/")[2]}`} aria-label={s.d.name} />
            <Link className="v3l tile" href={`/portfolio/${s.l.src.split("/")[2]}`} aria-label={s.l.name} />
          </figure>
        ))}
      </div>
      <div className="sheet-gap" style={{ height: 96 }} />
    </>
  );
}

/* `?scrollfx=rows` prototype, phones only: the first of each booking page's
   picks (lib/booking.ts); Graduation has none and keeps its SESSIONS photo. */
const ROW_SAMPLES: Partial<Record<SessionSlug, string>> = {
  portraits: "/work/gilt/03.jpg",
  headshots: "/work/headshots/04.jpg",
  "studio-digitals": "/work/giselle-studio-digitals/02.jpg",
  weddings: "/work/weddings/02.jpg",
};

/* Sessions index: pointing at a row brings its photo up; a click books it. */
function SessionsIndex() {
  const [on, setOn] = React.useState(INDEX_ORDER[0]);
  const fx = React.useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(location.search).get("scrollfx") === "rows" && matchMedia("(max-width: 800px)").matches,
    () => false,
  );
  const list = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  /* `?scrollfx=rows`: the row on the screen's center line takes the photo,
     its own, opening under it (gsap, loaded only with the flag); the one
     open before closes. A photo closing above the row would pull the list
     up under the center line and set off the next row, so the page scrolls
     back by exactly what it gives up, frame by frame (the browser's own
     anchoring is off for the flag, v3.css). v3.css inks it. Observed against
     the screen above the line, not the line itself like the videos' Desk: a
     jump past a zero-height line fires nothing. The lowest row above the
     line is the one on it. */
  React.useEffect(() => {
    if (!fx) return;
    document.documentElement.dataset.scrollfx = "rows";
    const rows = [...list.current!.querySelectorAll<HTMLElement>(".row")];
    const panel = (i: number) => rows[i].nextElementSibling as HTMLElement;
    const up = new Set<number>();
    let cur = -1;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gsap = import("gsap").then((m) => m.gsap);
    const show = (at: number) => {
      if (at === cur) return;
      const was = cur;
      cur = at;
      rows.forEach((r, i) => r.toggleAttribute("data-open", i === at));
      gsap.then((g) => {
        // One curve for both, so one photo grows exactly as the other gives way.
        const t = { duration: still ? 0 : 0.7, ease: "power2.inOut", overwrite: true };
        g.to(panel(at), { height: "auto", ...t });
        if (was < 0) return;
        const p = panel(was);
        let h = p.offsetHeight;
        g.to(p, {
          height: 0,
          ...t,
          onUpdate: () => {
            const now = p.offsetHeight;
            if (was < at) shiftScroll(now - h);
            h = now;
          },
        });
      });
    };
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => (e.isIntersecting ? up.add(rows.indexOf(e.target as HTMLElement)) : up.delete(rows.indexOf(e.target as HTMLElement))));
        if (!up.size) return;
        const at = Math.max(...up);
        setOn(INDEX_ORDER[at]);
        show(at);
      },
      // The line sits just under the site header (160px down), so the open
      // photo and the two rows after it are all on screen (Julian).
      { rootMargin: `0px 0px ${160 - innerHeight}px 0px` },
    );
    rows.forEach((r) => io.observe(r));
    return () => {
      io.disconnect();
      gsap.then((g) => g.killTweensOf(rows.map((_, i) => panel(i))));
      delete document.documentElement.dataset.scrollfx;
    };
  }, [fx]);
  return (
    <div className="a-index" id="sessions">
      <div>
        <div className="sess-head">
          <h2>Sessions</h2>
          <p className="lbl mute">Book a shoot</p>
        </div>
        <div className="list" ref={list}>
          {INDEX_ORDER.map((slug, n) => {
            const s = SESSIONS[slug];
            return [
              <button
                key={slug}
                type="button"
                className={slug === on ? "row on" : "row"}
                onPointerEnter={() => !fx && setOn(slug)}
                onFocus={() => setOn(slug)}
                onClick={() => router.push(`/book/${slug}`)}
                data-fly-to={`/book/${slug}`}
                data-fly-src=".a-index .frame figure"
              >
                <span className="n lbl">{String(n + 1).padStart(2, "0")}</span>
                <span className="t">{s.name}</span>
                <span className="p lbl">{rate(s)}</span>
              </button>,
              fx ? (
                <div key={`${slug}-rx`} className="rx" aria-hidden>
                  <div className="rx-f">
                    <Duo d={ROW_SAMPLES[slug] ?? s.photo.d} l={ROW_SAMPLES[slug] ?? s.photo.l} alt="" sizes="100vw" />
                  </div>
                </div>
              ) : null,
            ];
          })}
        </div>
      </div>
      <div className="frame" style={{ margin: 0 }}>
        <figure style={{ margin: 0, height: "100%", position: "relative" }}>
          {INDEX_ORDER.map((slug) => fx && ROW_SAMPLES[slug] ? (
            <Duo key={slug} d={ROW_SAMPLES[slug]} l={ROW_SAMPLES[slug]} alt={`${SESSIONS[slug].name} sample`} sizes="100vw" className={slug === on ? "on" : "off"} />
          ) : (
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

export function V3Home() {
  return (
    <section className="v3 v3home">
      <Hero />
      <Clients />
      <Recent />
      <Commissions />
      <SessionsIndex />
      <Doors />
      <V3Foot />
    </section>
  );
}
