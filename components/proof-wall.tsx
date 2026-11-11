"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import DriftWall from "@/components/drift-wall";

/* ── the proof gate over the 404's wall, behind ?proofwall=1 ──────────
 * Julian (2026-11-10): the 404's wall (`DriftWall`) under a glass card,
 * carrying this gallery's own watermarked frames, and the move from
 * sign-in to gallery seamless. Then: the photos must not travel left or
 * right to reach the gallery. So the wall is laid out on the gallery's
 * own columns: one wall column of the grid's width for each, carrying
 * that column's frames in order, with spare columns either side for the
 * tilt. On Open proofs the wall eases flat and face on, stops and comes
 * sharp, lined up with the grid; then each photo on the gallery's first
 * screen drops straight down or up from its own tile into its cell,
 * uncropping as it lands, while the rest of the wall falls away.
 * ─────────────────────────────────────────────────────────────── */

const READY_AFTER_MS = 900; // after the wall shows: the columns mostly in before the focus pull
const FLAT_MS = 800; // the plane easing flat and sharp (drift-wall.tsx), then the drop
const LAND_MS = 1000;
const LAND_EASE = "cubic-bezier(.6,0,.15,1)";
const STAGGER = 50; // ms a column, left to right
const WALL_OUT_MS = 600;
const ROWS = 6; // a wall column's length (DriftWall takes at most six)

type Frame = { src: string; w: number; h: number };
type Box = { x: number; y: number; w: number; h: number; img: HTMLImageElement };

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Every loaded wall tile within a screen of the view, as a box in the viewport. */
function tilesNear(root: HTMLElement): Box[] {
  const out: Box[] = [];
  for (const img of root.querySelectorAll<HTMLImageElement>(".drift-wall__tile img.is-loaded")) {
    const r = img.getBoundingClientRect();
    if (r.width < 8 || r.width > innerWidth || r.bottom < -innerHeight || r.top > 2 * innerHeight) continue;
    out.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, img });
  }
  return out;
}

/** The grid's columns as "count,width,gap,offset from the middle of the screen": a string, so it compares. */
function gridShape(g: HTMLElement | null) {
  if (!g) return "";
  const cs = getComputedStyle(g);
  const cols = cs.gridTemplateColumns.split(" ").map(parseFloat).filter((n) => n > 0);
  if (!cols.length) return "";
  const gap = parseFloat(cs.columnGap) || 0;
  const left = g.getBoundingClientRect().left + (parseFloat(cs.paddingLeft) || 0);
  const width = cols.length * cols[0] + (cols.length - 1) * gap;
  return [cols.length, cols[0], gap, left + width / 2 - innerWidth / 2].map((n) => Math.round(n * 100) / 100).join(",");
}
const onResize = (cb: () => void) => {
  addEventListener("resize", cb);
  return () => removeEventListener("resize", cb);
};

export function ProofWall({
  frames,
  grid,
  isEmail,
  onAccept,
  onDone,
}: {
  frames: Frame[];
  grid: React.RefObject<HTMLDivElement | null>;
  isEmail: (v: string) => boolean;
  onAccept: (name: string, email: string) => void;
  onDone: () => void;
}) {
  const layer = React.useRef<HTMLDivElement>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [bad, setBad] = React.useState<string | null>(null);
  // Julian (2026-11-10): the load-up should feel premium. The wall streams in sharp, every other column from above and below, then racks
  // focus to blur as the card rises in, its lines one after another (`[data-ready]`, proof.css).
  const [ready, setReady] = React.useState(false);
  const [flat, setFlat] = React.useState(false);
  const shown = React.useCallback(() => {
    window.setTimeout(() => setReady(true), reducedMotion() ? 0 : READY_AFTER_MS);
  }, []);

  // The wall on the grid's columns (the grid is laid out, hidden, under the gate).
  const shape = React.useSyncExternalStore(onResize, () => gridShape(grid.current), () => "");
  const wall = React.useMemo(() => {
    if (!shape || !frames.length) return null;
    const [n, w, gap, dx] = shape.split(",").map(Number);
    // Spare columns either side, enough to fill the tilted view (DriftWall's own "fill").
    const side = Math.max(1, Math.ceil((Math.ceil((innerWidth * 1.5) / (w + gap)) - n) / 2));
    const cols = n + 2 * side;
    // Row by row, as DriftWall deals them out (item i to column i % cols): an inner column carries
    // its grid column's frames top down, the spares the frames past the first screens.
    const items: { image: string }[] = [];
    let spare = n * ROWS;
    for (let r = 0; r < ROWS; r++)
      for (let j = 0; j < cols; j++) {
        const c = j - side;
        const i = c >= 0 && c < n ? c + r * n : spare++;
        items.push({ image: frames[i % frames.length].src });
      }
    return { items, cols, w, gap, dx };
  }, [shape, frames]);

  // The page holds still under the wall.
  React.useEffect(() => {
    const el = document.documentElement;
    const was = el.style.overflow;
    el.style.overflow = "hidden";
    scrollTo(0, 0);
    return () => {
      el.style.overflow = was;
    };
  }, []);

  function open() {
    if (flat) return;
    const still = reducedMotion();
    setFlat(true);
    window.setTimeout(() => land(still), still ? 0 : FLAT_MS);
  }

  function land(still: boolean) {
    const root = layer.current;
    const tiles = root && !still ? tilesNear(root) : [];
    flushSync(() => onAccept(name.trim().replace(/\s+/g, " "), email.trim()));
    const cells = [...(grid.current?.querySelectorAll<HTMLElement>(".proof-cell") ?? [])];
    const anims: Animation[] = [];
    const used = new Set<Box>();
    // Per grid column: how far its wall column slides, up or down, so its first frame lands on its first cell.
    // The whole strip slides as one and every cell rides on its own tile.
    const shift = new Map<number, number>();
    const pitch = wall ? wall.w + wall.gap : 1;
    const x0 = cells[0]?.getBoundingClientRect().left ?? 0;
    const tileOf = (src: string | null | undefined, cx: number, y: number) => {
      let from: Box | null = null;
      for (const t of tiles)
        if (!used.has(t) && t.img.getAttribute("src") === src && Math.abs(t.x - cx) < pitch / 2 && (!from || Math.abs(t.y - y) < Math.abs(from.y - y))) from = t;
      return from;
    };
    for (const cell of still ? [] : cells) {
      const to = cell.getBoundingClientRect();
      if (to.top > innerHeight || !to.width) break;
      const src = cell.querySelector("img")?.getAttribute("src");
      const col = Math.round((to.left - x0) / pitch);
      const cx = to.left + to.width / 2;
      const cy = to.top + to.height / 2;
      const delay = col * STAGGER;
      let from = tileOf(src, cx, cy - (shift.get(col) ?? 0));
      if (from && !shift.has(col)) {
        const dy = cy - from.y;
        shift.set(col, dy);
        const track = from.img.closest<HTMLElement>(".drift-wall__track");
        track?.animate([{ translate: "0 0" }, { translate: `0 ${dy}px` }], { duration: LAND_MS, easing: LAND_EASE, delay, fill: "forwards" });
        from = tileOf(src, cx, cy - dy);
      }
      if (!from) {
        anims.push(cell.animate([{ transform: "translateY(40px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: LAND_MS * 0.8, easing: LAND_EASE, delay, fill: "backwards" }));
        continue;
      }
      used.add(from);
      from.img.style.visibility = "hidden";
      // The tile shows the frame cropped to 3:4 (object-fit: cover): start as that crop, open to the whole frame.
      const s = Math.max(from.w / to.width, from.h / to.height);
      const ix = Math.max(0, (to.width - from.w / s) / 2);
      const iy = Math.max(0, (to.height - from.h / s) / 2);
      anims.push(
        cell.animate(
          [
            { transform: `translate(${from.x - cx}px, ${from.y - cy}px) scale(${s})`, clipPath: `inset(${iy}px ${ix}px)` },
            { transform: "none", clipPath: "inset(0px 0px)" },
          ],
          { duration: LAND_MS, easing: LAND_EASE, delay, fill: "backwards" },
        ),
      );
    }
    const out = root?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: still ? 200 : WALL_OUT_MS, delay: still ? 0 : LAND_MS * 0.55, easing: "ease-out", fill: "forwards" });
    Promise.all([out?.finished, ...anims.map((a) => a.finished)].map((p) => p?.catch(() => {}))).then(onDone);
  }

  return (
    <>
      <div ref={layer} className="pw-layer" data-ready={ready || undefined} data-flat={flat || undefined}>
        {wall ? (
          <DriftWall
            items={wall.items}
            columns={wall.cols}
            tileWidth={wall.w}
            tileHeight={Math.round((wall.w * 4) / 3)}
            gap={wall.gap}
            radius={2}
            speed={24}
            dim={0.4}
            overlayColor="var(--background)"
            density={0.5}
            flatten={flat ? wall.dx : undefined}
            onShown={shown}
          />
        ) : null}
        <div aria-hidden className="pw-vig" />
        <div aria-hidden className="pw-grain" />
      </div>
      <form
        className="proof-card pw-card"
        data-ready={ready || undefined}
        data-out={flat || undefined}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const msg = !name.trim() ? "Add your name." : !isEmail(email) ? "That email does not look right." : null;
          setBad(msg);
          if (!msg) open();
        }}
      >
        <div>
          <p className="proof-lab">Proofs · {frames.length} frames</p>
          <h1>Pick your proofs.</h1>
        </div>
        <label>
          <span className="proof-lab">Your name</span>
          <input
            name="name"
            autoComplete="name"
            required
            value={name}
            placeholder="Your name"
            aria-invalid={bad === "Add your name." || undefined}
            onChange={(e) => {
              setName(e.target.value);
              setBad(null);
            }}
          />
        </label>
        <label>
          <span className="proof-lab">Your email</span>
          <input
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            placeholder="you@email.com"
            aria-invalid={(!!bad && bad !== "Add your name.") || undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              setBad(null);
            }}
          />
        </label>
        {bad ? (
          <p className="proof-err" role="alert">
            {bad}
          </p>
        ) : null}
        <button type="submit" className="proof-btn">
          Open proofs
        </button>
        <p className="proof-mu">Keep track of your favorites.</p>
      </form>
    </>
  );
}
