"use client";

/* ── the signature pad ────────────────────────
 * Finger, pen, trackpad or mouse. Pointer events into a 600 x 200 box,
 * smoothed with quadratic curves through the midpoints, handed up as SVG
 * path data (`isMark` in lib/contracts/contract.ts checks it again).
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";

type Pt = [number, number];
const W = 600;
const H = 200;
const r = (n: number) => Math.round(n * 10) / 10;

/** One stroke as path data: a dot for a tap, curves through the midpoints otherwise. */
function strokePath(p: Pt[]): string {
  if (p.length === 1) return `M${r(p[0][0])} ${r(p[0][1])} L${r(p[0][0] + 0.1)} ${r(p[0][1])}`;
  let d = `M${r(p[0][0])} ${r(p[0][1])}`;
  for (let i = 1; i < p.length - 1; i++)
    d += ` Q${r(p[i][0])} ${r(p[i][1])} ${r((p[i][0] + p[i + 1][0]) / 2)} ${r((p[i][1] + p[i + 1][1]) / 2)}`;
  const l = p[p.length - 1];
  return `${d} L${r(l[0])} ${r(l[1])}`;
}

export function SignPad({ onChange }: { onChange: (mark: string | null) => void }) {
  const [strokes, setStrokes] = React.useState<Pt[][]>([]);
  const box = React.useRef<SVGSVGElement>(null);
  const live = React.useRef<Pt[] | null>(null);
  const all = React.useRef<Pt[][]>([]);
  const draw = (s: Pt[][]) => {
    all.current = s;
    setStrokes(s);
  };

  const at = (e: { clientX: number; clientY: number }): Pt => {
    const b = box.current!.getBoundingClientRect();
    return [Math.min(W, Math.max(0, ((e.clientX - b.left) / b.width) * W)), Math.min(H, Math.max(0, ((e.clientY - b.top) / b.height) * H))];
  };

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button > 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = [at(e)];
    draw([...all.current, live.current]);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const cur = live.current;
    if (!cur) return;
    // Coalesced events keep a quick flourish smooth on a 60 Hz screen.
    const evs = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of evs) {
      const p = at(ev);
      const q = cur[cur.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.2) cur.push(p);
    }
    draw([...all.current.slice(0, -1), [...cur]]);
  };
  const up = () => {
    if (!live.current) return;
    live.current = null;
    onChange(all.current.length ? all.current.map(strokePath).join(" ") : null);
  };
  const clear = () => {
    draw([]);
    onChange(null);
  };

  return (
    <div className="ctr-pad" data-on={strokes.length > 0 || undefined}>
      <svg
        ref={box}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={strokes.length ? "Your signature" : "Signature box. Draw your signature with a finger, pen, trackpad or mouse."}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
      >
        {strokes.map((p, i) => (
          <path key={i} d={strokePath(p)} />
        ))}
      </svg>
      <span className="ctr-pad-x" aria-hidden>
        ×
      </span>
      <span className="ctr-pad-hint" aria-hidden>
        Sign here
      </span>
      <button type="button" className="ctr-pad-clear" onClick={clear} hidden={!strokes.length}>
        Clear
      </button>
    </div>
  );
}
