"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import DriftWall from "@/components/drift-wall";

/* ── the proof gate over the 404's wall, behind ?proofwall=1 ──────────
 * Julian (2026-11-10, after v3.0.171): the tilted grid wall looked
 * horrible; use the 404's wall (`DriftWall`, as `app/not-found.tsx` sets
 * it) and make the move from sign-in to gallery seamless. So the wall is
 * the 404's, carrying this gallery's own watermarked frames, under a
 * glass card. On accept the gallery is laid out underneath at once, and
 * each photo in its first screen flies out of the wall: from a tile
 * showing the same frame where one is in view, from the nearest free tile
 * otherwise, growing into its cell, while the rest of the wall and the
 * card fall away. One move, no cut.
 * ─────────────────────────────────────────────────────────────── */

// Julian: the wall keeps going until Open proofs, then eases each photo into its spot.
const FLY_MS = 1250;
const FLY_EASE = "cubic-bezier(.45,0,.15,1)";
const STAGGER = 36; // ms per cell, in reading order
const WALL_OUT_MS = 650;
const CARD_OUT_MS = 220;

type Frame = { src: string; w: number; h: number };
type Box = { x: number; y: number; w: number; h: number; img: HTMLImageElement };

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Every wall tile on screen with its photograph loaded, as a box in the viewport. */
function tilesInView(root: HTMLElement): Box[] {
  const out: Box[] = [];
  for (const img of root.querySelectorAll<HTMLImageElement>(".drift-wall__tile img.is-loaded")) {
    const r = img.getBoundingClientRect();
    // A tile swung behind the camera projects to a huge box: not in view.
    if (r.width < 8 || r.width > innerWidth || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    out.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, img });
  }
  return out;
}

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
  const card = React.useRef<HTMLFormElement>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [bad, setBad] = React.useState<string | null>(null);
  // The 404's wall carries the first two dozen frames: what the gallery opens on.
  const items = React.useMemo(() => frames.slice(0, 24).map((f) => ({ image: f.src })), [frames]);

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
    const root = layer.current;
    const tiles = root ? tilesInView(root) : [];
    flushSync(() => onAccept(name.trim().replace(/\s+/g, " "), email.trim()));
    const cells = [...(grid.current?.querySelectorAll<HTMLElement>(".proof-cell") ?? [])];
    const anims: Animation[] = [];
    const still = reducedMotion();

    if (!still) {
      const free = new Set(tiles);
      let k = 0;
      for (const cell of cells) {
        const to = cell.getBoundingClientRect();
        if (to.top > innerHeight || !to.width) break;
        const src = cell.querySelector("img")?.getAttribute("src");
        const cx = to.left + to.width / 2;
        const cy = to.top + to.height / 2;
        // Its own frame on the wall if one is in view, else the nearest tile left.
        let from: Box | null = null;
        let best = Infinity;
        for (const t of free) {
          const d = (t.img.getAttribute("src") === src ? 0 : 1e9) + Math.hypot(t.x - cx, t.y - cy);
          if (d < best) [best, from] = [d, t];
        }
        const delay = k++ * STAGGER;
        if (from) {
          free.delete(from);
          from.img.style.visibility = "hidden";
          const s = Math.min(from.w / to.width, from.h / to.height);
          anims.push(
            cell.animate([{ transform: `translate(${from.x - cx}px, ${from.y - cy}px) scale(${s})` }, { transform: "none" }], {
              duration: FLY_MS,
              easing: FLY_EASE,
              delay,
              fill: "backwards",
            }),
          );
        } else {
          anims.push(cell.animate([{ transform: "translateY(24px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: FLY_MS * 0.7, easing: FLY_EASE, delay, fill: "backwards" }));
        }
      }
    }

    card.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CARD_OUT_MS, easing: "ease-in", fill: "forwards" });
    const out = root?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: still ? 200 : WALL_OUT_MS, easing: "ease-out", fill: "forwards" });
    Promise.all([out?.finished, ...anims.map((a) => a.finished)].map((p) => p?.catch(() => {}))).then(onDone);
  }

  return (
    <>
      <div ref={layer} className="pw-layer">
        <DriftWall items={items} speed={24} dim={0.4} build overlayColor="var(--background)" density={0.5} />
        <div aria-hidden className="pw-grain" />
      </div>
      <form
        ref={card}
        className="proof-card pw-card"
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
