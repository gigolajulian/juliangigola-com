"use client";

import * as React from "react";
import Image from "next/image";
import { V3Foot } from "@/components/v3/chrome";
import { Mark } from "@/components/v3/duo";
import { REEL, SECTIONS, creditOf, embedUrl, previewUrl, posterFor, sectionName, type Video, type VideoSection } from "@/lib/videos";

/* JG V3 Motion (Julian): A as an index over one full-screen stage;
   scrolling swaps the film and its title, bottom left. Phones get the same
   stage, on stills. Every film plays muted once it is
   in frame; a click opens the player, and Back, Esc, the browser's back or
   a click outside the film puts the visitor where they were. */

const reel: Video = { id: "reel", title: REEL.title, provider: REEL.provider, videoId: REEL.videoId, section: "music", poster: REEL.poster, previewAt: 0 };
/* Julian's order: the reel, Clean, Ladera Granola, The Description, then
   the rest varied between the two sections. */
const ORDER = ["youtube-lmR6-qjutn0", "vimeo-895734192", "youtube-E7N7HDnQjfI", "youtube-9QGO20Jgz7s", "youtube-ym7xEK50OT0", "youtube-pwzi7LKu-_I", "youtube-bqw03DYQavM", "youtube-1e1fYalqTJs"];
const rank = (v: Video) => (ORDER.indexOf(v.id) + 1 || 99);
/* A client's logo slug; Sammy Shiblaq releases under Empire, Imanemun's
   Dide O Del under Paydar (Julian). */
const markOf = (client: string) => (client === "Sammy Shiblaq" ? "empire" : client === "Imanemun" ? "paydar" : client.toLowerCase().replace(/\s+/g, "-"));
const two = (n: number) => String(n).padStart(2, "0");
const subOf = (v: Video) => (v.id === "reel" ? "Reel" : [creditOf(v), v.year ?? sectionName(v.section)].filter(Boolean).join(" · "));
const still = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function useInView<T extends Element>() {
  const ref = React.useRef<T>(null);
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || still()) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, on] as const;
}

/* A muted preview. YouTube draws its own controls while a film loads, is
   paused or has just started (on phones even with controls=0), so the
   poster stays on top until the player says it has been playing a moment.
   A phone that blocks autoplay keeps the still. Vimeo's background mode
   has no controls; it shows after the same short wait. */
function Loop({ v }: { v: Video }) {
  const ref = React.useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = React.useState(false);
  const yt = v.provider === "youtube";
  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      let m;
      try { m = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      const state = m?.event === "onStateChange" ? m.info : m?.event === "infoDelivery" ? m.info?.playerState : undefined;
      if (typeof state !== "number") return;
      clearTimeout(t);
      if (state === 1) t = setTimeout(() => setReady(true), 2500);
      else setReady(false);
    };
    addEventListener("message", onMsg);
    return () => { clearTimeout(t); removeEventListener("message", onMsg); };
  }, []);
  const hello = () => {
    if (yt) ref.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
    else setTimeout(() => setReady(true), 2500);
  };
  return <iframe ref={ref} onLoad={hello} className="mo-loop" data-ready={ready || undefined} src={previewUrl(v) + (yt ? "&enablejsapi=1" : "")} title="" aria-hidden tabIndex={-1} allow="autoplay" />;
}

/* The player: the film over the whole screen, in a modal dialog with a
   history entry so the phone's back gesture closes it instead of leaving
   the page. YouTube's and Vimeo's own controls are off; ours drive both
   players over postMessage. A clear layer over the film takes every move
   and click (an iframe would swallow them): a move brings the bars back,
   a click plays or pauses. Paused, the film dims and the bars stay up. */
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const playerSrc = (v: Video) => embedUrl(v) + (v.provider === "youtube" ? "&controls=0&enablejsapi=1&iv_load_policy=3&cc_load_policy=0" : "&controls=0&api=1");

function Player({ v, list, onGo, onClose }: { v: Video | null; list: Video[]; onGo: (v: Video) => void; onClose: () => void }) {
  const n = v ? list.findIndex((x) => x.id === v.id) : 0;
  const prev = list[n - 1];
  const next = list[n + 1];
  const ref = React.useRef<HTMLDialogElement>(null);
  const frame = React.useRef<HTMLIFrameElement>(null);
  const [shown, setShown] = React.useState(true);
  const [paused, setPaused] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [time, setTime] = React.useState({ at: 0, dur: 0 });
  const t = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const poke = React.useCallback(() => {
    setShown(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setShown(false), 2500);
  }, []);
  React.useEffect(() => {
    const d = ref.current;
    if (!v || !d) return;
    setPaused(false);
    setMuted(false);
    setTime({ at: 0, dur: 0 });
    d.showModal();
    d.focus(); // not the iframe, which would swallow the keys
    poke();
    // One history entry for the player, however many films are stepped through in it.
    if (history.state?.player) history.replaceState({ player: v.id }, "");
    else history.pushState({ player: v.id }, "");
    addEventListener("popstate", onClose);
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      let m;
      try { m = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      if (m?.event === "infoDelivery" && m.info) {
        const i = m.info;
        if (typeof i.playerState === "number") setPaused(i.playerState === 2);
        if (typeof i.muted === "boolean") setMuted(i.muted);
        if (typeof i.currentTime === "number") setTime((p) => ({ at: i.currentTime, dur: i.duration ?? p.dur }));
      } else if (m?.event === "onStateChange") setPaused(m.info === 2);
      else if (m?.event === "pause" || m?.event === "play") setPaused(m.event === "pause");
      else if ((m?.event === "timeupdate" || m?.event === "playProgress") && m.data) setTime({ at: m.data.seconds, dur: m.data.duration });
      else if (m?.event === "ready" || m?.event === "onReady" || m?.event === "initialDelivery" || m?.event === "onApiChange") hello();
    };
    addEventListener("message", onMsg);
    return () => {
      clearTimeout(t.current);
      removeEventListener("popstate", onClose);
      removeEventListener("message", onMsg);
      if (d.open) d.close();
    };
  }, [v, onClose, poke]);

  const post = (yt: string, args: unknown[], vimeo: string, value?: unknown) => {
    const w = frame.current?.contentWindow;
    if (!w || !v) return;
    w.postMessage(JSON.stringify(v.provider === "youtube" ? { event: "command", func: yt, args } : { method: vimeo, value }), "*");
  };
  function hello() {
    const w = frame.current?.contentWindow;
    if (!w || !v) return;
    if (v.provider === "youtube") {
      w.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
      // Captions off by default, whatever the viewer's YouTube setting.
      for (const mod of ["captions", "cc"]) w.postMessage(JSON.stringify({ event: "command", func: "unloadModule", args: [mod] }), "*");
      w.postMessage(JSON.stringify({ event: "command", func: "setOption", args: ["captions", "track", {}] }), "*");
    } else for (const value of ["pause", "play", "timeupdate", "playProgress"]) w.postMessage(JSON.stringify({ method: "addEventListener", value }), "*");
  }
  const toggle = () => { post(paused ? "playVideo" : "pauseVideo", [], paused ? "play" : "pause"); setPaused(!paused); poke(); };
  const seek = (s: number) => { const at = Math.max(0, Math.min(time.dur, s)); post("seekTo", [at, true], "setCurrentTime", at); setTime((p) => ({ ...p, at })); poke(); };
  const sound = () => { post(muted ? "unMute" : "mute", [], "setMuted", !muted); setMuted(!muted); poke(); };
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : ref.current?.requestFullscreen());
  const back = () => history.back();
  const keys = (e: React.KeyboardEvent) => {
    poke();
    if ((e.target as HTMLElement).closest("button, input")) return;
    if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
    else if (e.key === "ArrowRight") seek(time.at + 5);
    else if (e.key === "ArrowLeft") seek(time.at - 5);
    else if (e.key === "m") sound();
    else if (e.key === "f") full();
  };
  const up = shown || paused;
  return (
    <dialog ref={ref} tabIndex={-1} className="v3 mo-player" aria-label={v?.title} data-shown={up || undefined} data-paused={paused || undefined} onPointerMove={poke} onKeyDown={keys} onCancel={(e) => { e.preventDefault(); if (document.fullscreenElement) document.exitFullscreen(); else back(); }}>
      {v ? (
        <>
          <iframe ref={frame} onLoad={hello} src={playerSrc(v)} title={v.title} tabIndex={-1} allow="autoplay; fullscreen; picture-in-picture" />
          <div className="pl-tint" />
          <div className="pl-wake" onClick={toggle} />
          {/* Paused (Julian): the outer thirds step to the film before and after. */}
          {paused && prev ? (
            <button type="button" className="pl-step prev" onClick={() => onGo(prev)}>
              <span className="lbl">← {two(n - 1)}</span><b>{prev.title}</b>
            </button>
          ) : null}
          {paused && next ? (
            <button type="button" className="pl-step next" onClick={() => onGo(next)}>
              <span className="lbl">{two(n + 1)} →</span><b>{next.title}</b>
            </button>
          ) : null}
          <div className="pl-bar lbl">
            <button type="button" onClick={back}>← Back</button>
            <span>{two(n)} / {two(list.length - 1)}</span>
          </div>
          <div className="pl-info">
            <div className="pl-meta">
              <div>
                <b>{v.title}</b>
                <span className="lbl">{subOf(v)}</span>
              </div>
              {v.client ? <Mark slug={markOf(v.client)} name={v.client} h={26} even /> : null}
            </div>
            <div className="pl-ctl lbl">
              <button type="button" onClick={toggle}>{paused ? "Play" : "Pause"}</button>
              <span className="pl-time">{clock(time.at)} / {clock(time.dur)}</span>
              <input type="range" min={0} max={time.dur || 1} step={0.1} value={time.at} onChange={(e) => seek(Number(e.target.value))} aria-label="Seek" style={{ "--p": `${time.dur ? (time.at / time.dur) * 100 : 0}%` } as React.CSSProperties} />
              <button type="button" onClick={sound}>{muted ? "Sound off" : "Sound on"}</button>
              <button type="button" onClick={full}>Full</button>
            </div>
          </div>
        </>
      ) : null}
    </dialog>
  );
}

function Desk({ films, onPlay }: { films: Video[]; onPlay: (v: Video) => void }) {
  const [i, setI] = React.useState(0);
  const moving = React.useSyncExternalStore(
    () => () => {},
    () => !still() && matchMedia("(min-width: 801px)").matches,
    () => false,
  );
  const steps = React.useRef<(HTMLDivElement | null)[]>([]);
  React.useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setI(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-50% 0px -50% 0px" },
    );
    steps.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const v = films[i];
  return (
    <div className="mo-desk">
      <div className="mo-stage">
        {films.map((f, j) => {
          const poster = posterFor(f);
          return (
            <div key={f.id} className="mo-shot" data-on={j === i || undefined}>
              {poster ? <Image src={poster} alt="" fill priority={j === 0} sizes="100vw" style={{ objectFit: "cover" }} /> : null}
              {moving && j === i ? <Loop v={f} /> : null}
            </div>
          );
        })}
        <button type="button" className="mo-hit" onClick={() => onPlay(v)} aria-label={`Play ${v.title}`} />
        <h1 className="mo-h lbl">Motion · {two(films.length)} films</h1>
        <div className="mo-cap" key={v.id}>
          <span className="lbl">{two(i)} · {subOf(v)}</span>
          <h2>{v.title}</h2>
        </div>
        <ol className="mo-index lbl">
          {films.map((f, j) => (
            <li key={f.id}>
              <button type="button" aria-current={j === i || undefined} onClick={() => steps.current[j]?.scrollIntoView({ behavior: still() ? "auto" : "smooth" })}>
                <span>{two(j)}</span>{f.title}
              </button>
            </li>
          ))}
        </ol>
        {/* The client's logo at the top of the film, under the page label (Julian). */}
        {v.client ? <span className="mo-mark" key={`${v.id}-mk`}><Mark slug={markOf(v.client)} name={v.client} h={26} even /></span> : null}
        <div className="mo-play">
          <button type="button" className="btn fill cn-light" onClick={() => onPlay(v)}>Play with sound</button>
        </div>
      </div>
      <div className="mo-steps" aria-hidden>
        {films.map((f, j) => <div key={f.id} data-i={j} ref={(el) => { steps.current[j] = el; }} />)}
      </div>
    </div>
  );
}

function Frame({ v, ratio, sizes, onPlay }: { v: Video; ratio: string; sizes: string; onPlay: (v: Video) => void }) {
  const [ref, on] = useInView<HTMLDivElement>();
  const poster = posterFor(v);
  return (
    <div ref={ref} className="cn-frame" style={{ aspectRatio: ratio }}>
      {poster ? <Image src={poster} alt="" fill sizes={sizes} style={{ objectFit: "cover" }} /> : null}
      {on ? <Loop v={v} /> : null}
      <button type="button" onClick={() => onPlay(v)} aria-label={`Play ${v.title}`} />
    </div>
  );
}

function Chapter({ v, n, ratio, small = false, sizes, onPlay }: { v: Video; n: number; ratio: string; small?: boolean; sizes: string; onPlay: (v: Video) => void }) {
  return (
    <article className={small ? "cn-ch sm" : "cn-ch"}>
      <Frame v={v} ratio={ratio} sizes={sizes} onPlay={onPlay} />
      <div className="cn-cap">
        <span className="cn-n">{two(n)}</span>
        <div>
          <h3>{v.title}</h3>
          <span className="lbl mute">{subOf(v)}</span>
        </div>
      </div>
    </article>
  );
}

function Row({ v, i, onOpen, bare = false }: { v: Video; i: number; onOpen: (v: Video) => void; bare?: boolean }) {
  const poster = posterFor(v);
  return (
    <button type="button" className="mo-row" onClick={() => onOpen(v)} aria-label={`Open ${v.title}`}>
      <span className="mo-frame">{poster ? <Image src={poster} alt="" fill sizes="100vw" priority={i === 0} style={{ objectFit: "cover" }} /> : null}</span>
      <span className="mo-row-cap">
        <span className="lbl mute">{bare ? subOf(v).split(" · ")[0] : subOf(v)}</span>
        <b>{v.title}</b>
      </span>
      {v.client ? <span className="mo-row-mk"><Mark slug={markOf(v.client)} name={v.client} h={20} even /></span> : null}
    </button>
  );
}

/* Phones (Julian): the films stacked, one 16:9 still each, for an easy
   scroll. A tap opens that film's page: it plays at the top, its title,
   credit and logo under it, the next two films side by side. A history entry
   per page, so the back gesture returns to the list. Stills in the list,
   because YouTube keeps its own controls on a phone's muted preview. */
function Stack({ films }: { films: Video[] }) {
  const [open, setOpen] = React.useState<Video | null>(null);
  React.useEffect(() => {
    const onPop = () => setOpen(films.find((f) => f.id === history.state?.film) ?? null);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, [films]);
  const go = (v: Video) => {
    if (history.state?.film) history.replaceState({ film: v.id }, "");
    else history.pushState({ film: v.id }, "");
    setOpen(v);
    scrollTo(0, 0);
  };
  if (!open)
    return (
      <div className="mo-stack">
        <h1 className="lbl mute">Motion · {two(films.length)} films</h1>
        {films.map((v, i) => <Row key={v.id} v={v} i={i} onOpen={go} />)}
      </div>
    );
  const n = films.findIndex((f) => f.id === open.id);
  return (
    <div className="mo-stack">
      <button type="button" className="mo-back lbl" onClick={() => history.back()}>← Motion</button>
      <div className="mo-film">
        <iframe key={open.id} src={embedUrl(open)} title={open.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      </div>
      <div className="mo-row mo-now">
        <span className="mo-row-cap">
          <span className="lbl mute">{subOf(open)}</span>
          <b>{open.title}</b>
        </span>
        {open.client ? <span className="mo-row-mk"><Mark slug={markOf(open.client)} name={open.client} h={24} even /></span> : null}
      </div>
      <h2 className="lbl mute mo-more">More films</h2>
      <div className="mo-pair">
        {films
          .map((_, k) => films[(n + 1 + k) % films.length])
          .filter((f) => f.id !== open.id && !f.title.startsWith("Iranian Americans")) // Julian: never suggested
          .slice(0, 2)
          .map((f) => <Row key={f.id} v={f} i={films.indexOf(f)} onOpen={go} bare />)}
      </div>
    </div>
  );
}

/* Retired 2026-10-24: phones get the stacked stills (Julian). Kept, unused. */
export function Mob({ videos, onPlay }: { videos: Video[]; onPlay: (v: Video) => void }) {
  const [tab, setTab] = React.useState<"all" | VideoSection>("all");
  const [ref, on] = useInView<HTMLDivElement>();
  const films = tab === "all" ? videos : videos.filter((v) => v.section === tab);
  /* The rhythm: a wide letterbox, then a big and a small side by side. */
  const rows: Video[][] = [];
  for (let i = 0; i < films.length; ) {
    const wide = rows.length % 2 === 0;
    rows.push(films.slice(i, i + (wide ? 1 : 2)));
    i += wide ? 1 : 2;
  }
  let n = 0;
  return (
    <div className="mo-mob">
      <div ref={ref} className="cn-hero">
        <Image src={REEL.poster} alt="" fill priority sizes="100vw" style={{ objectFit: "cover" }} />
        {on ? <Loop v={reel} /> : null}
        <div className="cn-hero-foot">
          <div>
            <span className="lbl">{REEL.title}</span>
            <h1 className="cn-t">Motion</h1>
          </div>
          <button type="button" className="btn fill cn-light" onClick={() => onPlay(reel)}>Play with sound</button>
        </div>
      </div>
      <div className="cn-tabs lbl" role="group" aria-label="Filter films">
        <button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")}>All <span>{two(videos.length)}</span></button>
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" aria-pressed={tab === s.id} onClick={() => setTab(s.id)}>
            {s.name} <span>{two(videos.filter((v) => v.section === s.id).length)}</span>
          </button>
        ))}
      </div>
      <div className="cn-run">
        {rows.map((r) =>
          r.length === 1 ? (
            <Chapter key={r[0].id} v={r[0]} n={++n} ratio="2.39 / 1" sizes="100vw" onPlay={onPlay} />
          ) : (
            <div key={r[0].id} className="cn-pair">
              {r.map((v, j) => (
                <Chapter key={v.id} v={v} n={++n} ratio="16 / 9" small={j === 1} sizes="100vw" onPlay={onPlay} />
              ))}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export function V3Video({ videos }: { videos: Video[] }) {
  const sorted = React.useMemo(() => [...videos].sort((a, b) => rank(a) - rank(b)), [videos]);
  const all = React.useMemo(() => [reel, ...sorted], [sorted]);
  const [playing, setPlaying] = React.useState<Video | null>(null);
  const close = React.useCallback(() => setPlaying(null), []);
  /* A client logo links here as #<client slug>: open on that client's film. */
  React.useEffect(() => {
    const j = all.findIndex((f) => f.client && `#${markOf(f.client)}` === location.hash);
    if (j < 1) return;
    const phone = matchMedia("(max-width: 800px)").matches;
    document.querySelectorAll(phone ? ".mo-stack .mo-row" : ".mo-steps > div")[j]?.scrollIntoView({ block: phone ? "center" : "start" });
  }, [all]);
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-video">
        <Desk films={all} onPlay={setPlaying} />
        <Stack films={all} />
        <V3Foot />
      </section>
      <Player v={playing} list={all} onGo={setPlaying} onClose={close} />
    </div>
  );
}
