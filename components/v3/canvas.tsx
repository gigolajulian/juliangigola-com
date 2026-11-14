"use client";

import * as React from "react";
import Link from "next/link";
import { getImageProps } from "next/image";
import { DECEL } from "@/lib/motion/throw";
import { isTrackpad } from "@/lib/motion/wheel";
import { projectHref } from "@/lib/project-href";
import type { WorkItem } from "@/components/v3/work";

/* The canvas view (mock approved by Julian, 2026-11-07): every frame
   of every project as one endless field you pan by dragging, flicking or
   scrolling. Columns loop on their own heights and starts, so the field
   repeats with no seam and no straight rows. A scale slider sets the size.
   Click a frame: it grows to the centre with its project's name and a link. */

const COLS = 16; // enough that 0.5× never shows a column twice on a wide screen
const GAP = 28;
const SCALE = { min: 0.5, max: 2, step: 0.05 };

/** One frame on the field: its project (index into `list`), photo, height / width, alt, colour. */
type Frame = { p: number; src: string; r: number; alt: string; color?: string };
type Col = { items: { i: number; y: number; h: number }[]; period: number; off: number };
type Cell = { f: HTMLElement; img: HTMLImageElement; cap: HTMLElement; i: number };
type Opened = { i: number; from: DOMRect };
type Frames = Record<string, [string, number, string, string][]>;

/* Upright frames sit as 3:4 on the field, like the grid and strip (Julian, 2026-11-07); square and wide keep theirs. The opened frame shows the whole photo. */
const shape = (r: number) => (r > 1.02 ? 4 / 3 : r);
const mod = (a: number, b: number) => ((a % b) + b) % b;

/** `bar`: the discipline chips and the view row. `onLeave`: Open project takes the canvas down. */
export function V3Canvas({ list, onClose, onLeave, bar }: { list: WorkItem[]; onClose: () => void; onLeave: () => void; bar: React.ReactNode }) {
  const field = React.useRef<HTMLDivElement>(null);
  /* Covers until `/canvas.json` lands, then every frame, projects in the page's order. */
  const [all, setAll] = React.useState<Frames | null>(null);
  React.useEffect(() => {
    let live = true;
    fetch("/canvas.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Frames | null) => live && j && setAll(j))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const frames = React.useMemo<Frame[]>(
    () =>
      list.flatMap((w, p) =>
        all?.[w.s]?.length
          ? all[w.s].map(([src, r, alt, color]) => ({ p, src, r, alt, color }))
          : [{ p, src: w.cover, r: 4 / 3, alt: w.n }],
      ),
    [list, all],
  );

  // The page under the canvas is inert, so focus moves to the bar's pressed view button.
  React.useEffect(() => {
    field.current?.parentElement?.querySelector<HTMLElement>('.cv-top .wviews [aria-pressed="true"]')?.focus();
  }, []);

  const [opened, setOpened] = React.useState<Opened | null>(null);
  const [grown, setGrown] = React.useState(false);
  const [hint, setHint] = React.useState(true);
  const [help, setHelp] = React.useState(false);
  const [scale, setScale] = React.useState(1);
  const openedRef = React.useRef(opened);
  React.useEffect(() => {
    openedRef.current = opened;
  }, [opened]);
  // The field's own handle on a new scale, so the camera survives a change.
  const rescale = React.useRef<(s: number) => void>(() => {});
  const scaleRef = React.useRef(scale);

  React.useEffect(() => {
    const el = field.current;
    if (!el || !frames.length) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0;
    let cols: Col[] = [];
    const srcs = new Map<number, { src: string; srcSet?: string }>();
    const layout = () => {
      const base = innerWidth < 700 ? innerWidth * 0.42 : Math.min(260, Math.max(200, innerWidth / 6.4));
      W = Math.round(base * scaleRef.current);
      srcs.clear();
      const per = Math.max(3, Math.ceil(frames.length / COLS));
      cols = Array.from({ length: COLS }, (_, c) => {
        let y = 0;
        const items = Array.from({ length: per }, (_, k) => {
          const i = (k * COLS + c) % frames.length, h = Math.round(W * shape(frames[i].r));
          const it = { i, y, h };
          y += h + GAP + ((c * 7 + k * 3) % 5) * 14;
          return it;
        });
        return { items, period: y, off: ((c * 137) % 260) - 130 };
      });
    };
    const props = (i: number) => {
      let p = srcs.get(i);
      if (!p) {
        const f = frames[i];
        const { props: ip } = getImageProps({ src: f.src, alt: "", width: W, height: Math.round(W * f.r), sizes: `${W}px` });
        p = { src: ip.src, srcSet: ip.srcSet };
        srcs.set(i, p);
      }
      return p;
    };

    const pool: Cell[] = [];
    const cell = (n: number) => {
      while (pool.length <= n) {
        const f = document.createElement("figure");
        f.className = "cv-cell";
        f.innerHTML = '<img alt="" draggable="false" decoding="async"><span class="cv-cap lbl"></span>';
        el.appendChild(f);
        pool.push({ f, img: f.firstChild as HTMLImageElement, cap: f.lastChild as HTMLElement, i: -1 });
      }
      return pool[n];
    };

    // Camera position, velocity in px per ms, and a wheel notch's target.
    let x = 0, y = 0, vx = 0, vy = 0;
    let tx: number | null = null, ty: number | null = null;
    const draw = () => {
      const cw = W + GAP;
      const c0 = Math.floor(x / cw) - 1, c1 = Math.ceil((x + innerWidth) / cw) + 1;
      let n = 0;
      for (let ci = c0; ci <= c1; ci++) {
        const col = cols[mod(ci, COLS)], sx = ci * cw - x, base = y - col.off;
        const r0 = Math.floor(base / col.period) - 1, r1 = Math.ceil((base + innerHeight) / col.period);
        for (let r = r0; r <= r1; r++)
          for (const it of col.items) {
            const sy = r * col.period + it.y - base;
            if (sy > innerHeight + 40 || sy + it.h < -40) continue;
            const p = cell(n++);
            if (p.i !== it.i) {
              p.i = it.i;
              const fr = frames[it.i], w = list[fr.p], ip = props(it.i);
              if (ip.srcSet) p.img.srcset = ip.srcSet;
              else p.img.removeAttribute("srcset");
              p.img.src = ip.src;
              p.img.alt = fr.alt;
              p.f.style.backgroundColor = fr.color ?? "";
              p.cap.textContent = `${w.n} · ${w.d.join(", ")}`;
              p.f.dataset.i = String(it.i);
            }
            p.f.style.width = `${W}px`;
            p.f.style.height = `${it.h}px`;
            p.f.style.transform = `translate3d(${sx}px,${sy}px,0)`;
            p.f.style.display = "";
          }
      }
      // Every spare cell hides, also one a relayout already marked stale (i = -1).
      for (let k = n; k < pool.length; k++)
        if (pool[k].f.style.display !== "none") {
          pool[k].f.style.display = "none";
          pool[k].i = -1;
        }
    };

    let last = 0, raf = 0, held = false;
    const tick = (t: number) => {
      const dt = Math.min(48, t - (last || t));
      last = t;
      if (tx !== null && ty !== null) {
        // A wheel notch eases out to where it points.
        const k = 1 - Math.pow(0.0001, (dt / 1000) * 2.2);
        x += (tx - x) * k;
        y += (ty - y) * k;
        if (Math.abs(tx - x) < 0.3 && Math.abs(ty - y) < 0.3) {
          x = tx;
          y = ty;
          tx = ty = null;
        }
      } else if (!held && (vx || vy)) {
        // A flick runs out under iOS's deceleration, as a throw does on the strip.
        const f = Math.pow(DECEL, dt), s = (1 - f) / (1 - DECEL);
        x += vx * s;
        y += vy * s;
        vx *= f;
        vy *= f;
        if (Math.hypot(vx, vy) < 0.01) vx = vy = 0;
      }
      draw();
      if (held || tx !== null || vx || vy) raf = requestAnimationFrame(tick);
      else raf = last = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const quiet = () => setHint(false);

    // Drag: mouse, pen and finger alike. Speed from the last 80ms of the pull.
    let sx0 = 0, sy0 = 0, moved = false, pid = -1;
    let trail: [number, number, number][] = [];
    let downAt: HTMLElement | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || openedRef.current) return;
      held = true;
      moved = false;
      vx = vy = 0;
      tx = ty = null;
      pid = e.pointerId;
      sx0 = e.clientX;
      sy0 = e.clientY;
      trail = [[e.timeStamp, e.clientX, e.clientY]];
      downAt = (e.target as Element).closest<HTMLElement>(".cv-cell");
      kick();
    };
    const onMove = (e: PointerEvent) => {
      if (!held || e.pointerId !== pid) return;
      const p = trail[trail.length - 1];
      if (!moved && Math.hypot(e.clientX - sx0, e.clientY - sy0) > 4) {
        moved = true;
        el.dataset.grab = "";
        el.setPointerCapture(e.pointerId);
        quiet();
      }
      if (!moved) return;
      x -= e.clientX - p[1];
      y -= e.clientY - p[2];
      trail.push([e.timeStamp, e.clientX, e.clientY]);
      while (trail.length > 2 && e.timeStamp - trail[0][0] > 80) trail.shift();
    };
    const onUp = (e: PointerEvent) => {
      if (!held || e.pointerId !== pid) return;
      held = false;
      delete el.dataset.grab;
      if (moved) {
        const a = trail[0], b = trail[trail.length - 1], dt = b[0] - a[0];
        // A hand that stopped before letting go does not throw.
        if (e.type === "pointerup" && dt > 0 && e.timeStamp - b[0] < 60 && !reduced) {
          vx = -(b[1] - a[1]) / dt;
          vy = -(b[2] - a[2]) / dt;
        }
      } else if (downAt && e.type === "pointerup") {
        setGrown(false);
        setOpened({ i: Number(downAt.dataset.i), from: downAt.getBoundingClientRect() });
      }
      kick();
    };
    // Wheel: a trackpad pans one to one, a mouse notch glides.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (openedRef.current) return;
      quiet();
      vx = vy = 0;
      let dx = e.deltaX, dy = e.deltaY;
      if (e.shiftKey && !dx) [dx, dy] = [dy, 0];
      if (e.deltaMode === 1) [dx, dy] = [dx * 40, dy * 40];
      if (isTrackpad(e, devicePixelRatio) || reduced) {
        tx = ty = null;
        x += dx;
        y += dy;
      } else {
        tx = (tx ?? x) + dx * 1.4;
        ty = (ty ?? y) + dy * 1.4;
      }
      kick();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openedRef.current) setOpened(null);
        else onClose();
        return;
      }
      if ((e.target as Element | null)?.closest?.("input")) return;
      const s = 240;
      const m = ({ ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] } as Record<string, number[]>)[e.key];
      if (!m || openedRef.current) return;
      e.preventDefault();
      quiet();
      vx = vy = 0;
      tx = (tx ?? x) + m[0];
      ty = (ty ?? y) + m[1];
      kick();
    };
    const relayout = () => {
      for (const p of pool) p.i = -1;
      layout();
      draw();
    };
    // A new scale keeps the point at the screen's centre where it is.
    rescale.current = (s: number) => {
      const k = s / scaleRef.current, cx = innerWidth / 2, cy = innerHeight / 2;
      scaleRef.current = s;
      vx = vy = 0;
      tx = ty = null;
      x = (x + cx) * k - cx;
      y = (y + cy) * k - cy;
      relayout();
    };

    layout();
    draw();
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    addEventListener("keydown", onKey);
    addEventListener("resize", relayout);
    const html = document.documentElement, was = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      removeEventListener("keydown", onKey);
      removeEventListener("resize", relayout);
      html.style.overflow = was;
      for (const p of pool) p.f.remove();
    };
  }, [frames, list, onClose]);

  // The opened frame starts on its cell, then grows to the centre on the next frame.
  React.useEffect(() => {
    if (!opened) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(id);
  }, [opened]);

  const fr = opened ? frames[opened.i] : null;
  const p = fr ? list[fr.p] : null;
  let box: React.CSSProperties | undefined;
  if (opened && fr) {
    const r = opened.from;
    if (!grown) box = { left: r.left, top: r.top, width: r.width, height: r.height, transition: "none" };
    else {
      const h = Math.min(innerHeight * 0.78, innerWidth * 0.86 * fr.r), w = h / fr.r;
      box = { left: (innerWidth - w) / 2, top: (innerHeight - h) / 2, width: w, height: h };
    }
  }

  return (
    <div className="cv" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Portfolio canvas">
      <div className="cv-field" ref={field} />
      {/* An open frame has its own Back; the bar would sit under it. */}
      <div className="cv-top lbl" style={opened ? { visibility: "hidden" } : undefined}>
        {bar}
      </div>
      <div className="cv-foot lbl mute">
        <span>{hint || !all ? "Drag to explore" : `${frames.length} frames`}</span>
        <label className="cv-scale">
          Scale
          <input
            type="range"
            min={SCALE.min}
            max={SCALE.max}
            step={SCALE.step}
            value={scale}
            onChange={(e) => {
              const s = Number(e.target.value);
              setScale(s);
              rescale.current(s);
            }}
            onDoubleClick={() => {
              setScale(1);
              rescale.current(1);
            }}
          />
          <output>{scale.toFixed(2)}×</output>
        </label>
        <button type="button" className="cv-q" aria-expanded={help} onClick={() => setHelp((h) => !h)}>
          ?
        </button>
      </div>
      {help ? (
        <div className="cv-help">
          <p>Drag, flick or scroll in any direction. Every frame of every project, and the field never ends.</p>
          <p>Scale sets the size. Double-click it for 1×.</p>
          <p>Click a photo to open its project.</p>
          <p>A discipline brings its frames to the front.</p>
          <p className="mute">Arrow keys pan. Esc goes back to the grid.</p>
        </div>
      ) : null}
      {p && fr ? (
        <div
          className={grown ? "cv-open in" : "cv-open"}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpened(null);
          }}
        >
          <figure style={box}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img {...getImageProps({ src: fr.src, alt: fr.alt, fill: true, sizes: "80vh" }).props} />
          </figure>
          <div className="cv-meta">
            <div className="lbl mute">{p.d.join(", ")}</div>
            <h2>{p.n}</h2>
            {/* The canvas comes down before the page crossing: WebKit crashed snapshotting the
                live field into the view transition (4 of 4, iPhone, iPad and desktop). */}
            <Link className="lbl" href={projectHref(p.s)} onClick={onLeave}>
              Open project
            </Link>
          </div>
          {/* `absolute` opts out of work-view.css's touch rule, which sets every dialog button relative. */}
          <button type="button" className="cv-q cv-x lbl absolute" onClick={() => setOpened(null)}>
            Back
          </button>
        </div>
      ) : null}
    </div>
  );
}
