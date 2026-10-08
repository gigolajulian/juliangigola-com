"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { ArrangeCard } from "@/components/hero-arrange";
import { copyText } from "@/components/dial-copy-all";

/* ── the cover in 3D ──────────────────────────────────────────────
 * Julian: he could not see the photographs in 3D space, so a view like
 * Blender's, easy to work in, where the cards are planes in relation to
 * each other. Native CSS 3D, no library: each card is its photograph at
 * the place and size the page gives it (read off the page every frame,
 * so it is always the layout the window is showing), standing out from
 * the screen by its depth, with a pin down to the screen to show how far.
 * The screen is the grid at depth 0. The name, the role and the buttons
 * are one pane, drawn in front of everything, as the page draws them
 * over every card.
 *
 * Axes as Blender colours them: X red (across), Y green (down the
 * screen, as the page counts it), Z blue (toward the viewer, the depth).
 * Space and drag to orbit, shift or the right button to pan, scroll to
 * zoom. With a card picked, the cards in front of it fade and let clicks
 * through; alt+click picks the next card down; a click on nothing lets go.
 * Drag a card to move it across the screen; scroll over it for its
 * depth; drag an arrow of the picked card to move it along that axis
 * alone. Keys: 1 front, 3 side, 7 top, 0 home, 5 flat or perspective.
 * Depth is drawn larger than it is (`z ×`), since a card stands at most
 * 200px out of a screen 1400 wide. Dev server only.
 * ─────────────────────────────────────────────────────────────── */

const RED = "#ff3352";
const GREEN = "#8bdc00";
const BLUE = "#2890ff";
const PICK = "#ffa31a";
const DEPTH = 200;
const HOME = { yaw: -32, pitch: 18 };

type Item = { card: string; x: number; y: number; w: number; h: number; src: string };
type Scene = {
  items: Item[];
  view: { w: number; h: number };
  screen: { w: number; h: number };
  middle: { x: number; y: number; w: number; h: number } | null;
};

/* Common screens, as the browser's viewport (window less its bars). The
   switch shows only when the live Playwright window lends `__setSize`. */
const SIZES = [
  ["1280×720", 1280, 720],
  ["win 1366", 1366, 657],
  ["win 1536", 1536, 730],
  ["mba 13", 1440, 789],
  ["mbp 14", 1512, 865],
  ["mbp 16", 1728, 1000],
  ["1080p", 1920, 960],
  ["1440p", 2560, 1305],
  ["ultrawide", 2560, 960],
  ["ipad", 1180, 820],
  ["ipad tall", 820, 1180],
  ["iphone se", 375, 667],
  ["phone", 390, 844],
] as const;
type SetSize = (w: number, h: number) => Promise<void>;

let spaceHeld = false;

const rad = (d: number) => (d * Math.PI) / 180;

export function Hero3D({
  cover,
  shape,
  cards,
  pull,
  picked,
  onPick,
  set,
  mid,
  setMid,
  onClose,
}: {
  cover: () => HTMLElement | null | undefined;
  shape: string;
  cards: Record<string, ArrangeCard>;
  pull: { width: number; height: number };
  picked: string | null;
  onPick: (card: string | null) => void;
  set: (card: string, patch: Partial<ArrangeCard>) => void;
  mid: { x: number; y: number };
  setMid: (patch: { x: number; y: number }) => void;
  onClose: () => void;
}) {
  const [scene, setScene] = React.useState<Scene>({ items: [], view: { w: 1, h: 1 }, screen: { w: 1, h: 1 }, middle: null });
  const [view, setView] = React.useState({ ...HOME, zoom: 1, x: 0, y: 0 });
  const [flat, setFlat] = React.useState(false);
  const [zScale, setZScale] = React.useState(3);
  const [help, setHelp] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  const coverRef = React.useRef(cover);
  React.useEffect(() => {
    coverRef.current = cover;
  });

  /* The page, read every frame while open: where each card stands in the
     layout showing, the middle pane, the screen (and the window, which
     the fit follows). */
  React.useEffect(() => {
    let raf = 0;
    let last = "";
    const read = () => {
      raf = requestAnimationFrame(read);
      const el = coverRef.current();
      const ring = el?.querySelector<HTMLElement>(".cover-float-ring");
      if (!el || !ring) return;
      const W = ring.clientWidth;
      const H = ring.clientHeight;
      const items = [...el.querySelectorAll<HTMLElement>(".cover-float-frame")]
        .filter((f) => f.offsetWidth > 0 && f.dataset.card)
        .map((f) => ({
          card: f.dataset.card!,
          x: f.offsetLeft + f.offsetWidth / 2 - W / 2,
          y: f.offsetTop + f.offsetHeight / 2 - H / 2,
          w: f.offsetWidth,
          h: f.offsetHeight,
          src: f.querySelector("img")?.currentSrc ?? "",
        }));
      const c = el.getBoundingClientRect();
      /* The middle as its text and buttons stand, not its padded box. */
      const kids = [...(el.querySelector(".cover-float-middle")?.children ?? [])]
        .map((k) => k.getBoundingClientRect())
        .filter((r) => r.width > 0);
      const m = kids.length
        ? (() => {
            const left = Math.min(...kids.map((r) => r.left));
            const top = Math.min(...kids.map((r) => r.top));
            return {
              left,
              top,
              width: Math.max(...kids.map((r) => r.right)) - left,
              height: Math.max(...kids.map((r) => r.bottom)) - top,
            };
          })()
        : null;
      const next: Scene = {
        items,
        view: { w: innerWidth, h: innerHeight },
        screen: { w: W, h: H },
        middle: m
          ? { x: m.left + m.width / 2 - c.left - W / 2, y: m.top + m.height / 2 - c.top - H / 2, w: m.width, h: m.height }
          : null,
      };
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setScene(next);
      }
    };
    raf = requestAnimationFrame(read);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* The screen fitted to 60% of the view; zoom on top of that. */
  const size = scene.view;
  const fit = Math.min((size.w * 0.6) / scene.screen.w, (size.h * 0.6) / scene.screen.h) || 1;
  const S = fit * view.zoom;
  /* Where a direction in the scene lands on screen, for dragging along an
     axis: rotateY then rotateX, as the stage's transform. */
  const toScreen = React.useCallback(
    ([x, y, z]: [number, number, number]) => {
      const b = rad(view.yaw);
      const a = rad(view.pitch);
      const x1 = x * Math.cos(b) + z * Math.sin(b);
      const z1 = -x * Math.sin(b) + z * Math.cos(b);
      const y2 = y * Math.cos(a) - z1 * Math.sin(a);
      return [x1 * S, y2 * S] as const;
    },
    [view.yaw, view.pitch, S],
  );

  /* Page px to the layout's own numbers: a share of the screen, through
     the panel's spread. */
  const dxPct = (px: number) => (px / scene.screen.w) * 100 / pull.width;
  const dyPct = (px: number) => (px / scene.screen.h) * 100 / pull.height;
  const round = (v: number, s = 0.5) => Math.round(v / s) * s;

  /* Space held, for the orbit (module state: read in handlers only). */
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== "Space" || (e.target as Element).closest?.("input, textarea")) return;
      e.preventDefault();
      spaceHeld = e.type === "keydown";
    };
    const off = () => (spaceHeld = false);
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    window.addEventListener("blur", off);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("keyup", key, true);
      window.removeEventListener("blur", off);
    };
  }, []);

  const drag = (e: React.PointerEvent, run: (dx: number, dy: number) => void, view = false) => {
    // With space held every drag turns the view: let it through to the orbit.
    if (spaceHeld && !view) return;
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const move = (ev: PointerEvent) => run(ev.clientX - x0, ev.clientY - y0);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* A card dragged: across the screen's plane, however the view is
     turned (the drag solved back through the two axes' directions). */
  const moveCard = (e: React.PointerEvent, card: string) => {
    if (e.altKey && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      const stack = [...new Set(document.elementsFromPoint(e.clientX, e.clientY)
        .map((el) => el.closest<HTMLElement>("[data-card3d]")?.dataset.card3d)
        .filter((id): id is string => !!id))];
      onPick(stack[(stack.indexOf(picked ?? "") + 1) % stack.length] ?? card);
      return;
    }
    onPick(card);
    if (e.button !== 0) return;
    const c0 = cards[card];
    if (!c0) return;
    const [ax, ay] = toScreen([1, 0, 0]);
    const [bx, by] = toScreen([0, 1, 0]);
    const det = ax * by - bx * ay;
    drag(e, (dx, dy) => {
      if (Math.abs(det) < 1e-3 * S * S) return; // edge on: nothing to solve
      const wx = (dx * by - bx * dy) / det;
      const wy = (ax * dy - dx * ay) / det;
      set(card, {
        place: {
          x: round(Math.max(-15, Math.min(105, c0.place.x + dxPct(wx)))),
          y: round(Math.max(-100, Math.min(15, c0.place.y - dyPct(wy)))),
        },
      });
    });
  };

  /* The middle dragged, as a card: its x and y are shares of the screen. */
  const moveMid = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const m0 = mid;
    const [ax, ay] = toScreen([1, 0, 0]);
    const [bx, by] = toScreen([0, 1, 0]);
    const det = ax * by - bx * ay;
    drag(e, (dx, dy) => {
      if (Math.abs(det) < 1e-3 * S * S) return;
      const wx = (dx * by - bx * dy) / det;
      const wy = (ax * dy - dx * ay) / det;
      setMid({
        x: round(Math.max(-50, Math.min(50, m0.x + (wx / scene.screen.w) * 100))),
        y: round(Math.max(-50, Math.min(50, m0.y + (wy / scene.screen.h) * 100))),
      });
    });
  };

  /* Along one axis alone, from the picked card's arrows. */
  const moveAxis = (e: React.PointerEvent, card: string, axis: 0 | 1 | 2) => {
    const c0 = cards[card];
    if (!c0) return;
    const dir: [number, number, number] = [axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? zScale : 0];
    const [sx, sy] = toScreen(dir);
    const len2 = sx * sx + sy * sy;
    drag(e, (dx, dy) => {
      if (len2 < 1e-4) return;
      const t = (dx * sx + dy * sy) / len2; // in page px (or depth px)
      if (axis === 0) set(card, { place: { x: round(Math.max(-15, Math.min(105, c0.place.x + dxPct(t)))), y: c0.place.y } });
      if (axis === 1) set(card, { place: { x: c0.place.x, y: round(Math.max(-100, Math.min(15, c0.place.y - dyPct(t)))) } });
      if (axis === 2) set(card, { depth: Math.round(Math.max(-DEPTH, Math.min(DEPTH, c0.depth + t))) });
    });
  };

  /* Scale from the corner: the card grows about its middle, so the corner
     moves half the change; the drag read along the card's diagonal. */
  const scaleCard = (e: React.PointerEvent, card: string, w0: number) => {
    const c0 = cards[card];
    if (!c0 || !w0) return;
    const [sx, sy] = toScreen([1, 1, 0]);
    const len2 = sx * sx + sy * sy;
    drag(e, (dx, dy) => {
      if (len2 < 1e-4) return;
      const t = (dx * sx + dy * sy) / len2; // scene px along x
      set(card, { width: round(Math.max(4, Math.min(40, (c0.width * (w0 + 2 * t)) / w0)), 0.5) });
    });
  };

  /* Empty space: orbit, or pan with shift or the right button. */
  const orbit = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("[data-hud]")) return;
    const v0 = view;
    const pan = e.shiftKey || e.button === 2 || e.button === 1;
    // Julian: turning only with space held, so a missed grab never turns it.
    if (!pan && !spaceHeld) {
      if (e.button === 0) onPick(null); // a click on nothing lets the pick go
      return;
    }
    drag(
      e,
      (dx, dy) =>
        setView(
          pan
            ? { ...v0, x: v0.x + dx, y: v0.y + dy }
            : { ...v0, yaw: v0.yaw + dx * 0.35, pitch: Math.max(-89, Math.min(89, v0.pitch - dy * 0.35)) },
        ),
      true,
    );
  };

  /* The wheel: over a card, its depth, as on the page; elsewhere, zoom.
     Native, so the strip underneath never pages. */
  const latest = React.useRef({ cards, set, onPick });
  React.useEffect(() => {
    latest.current = { cards, set, onPick };
  });
  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const card = (e.target as Element).closest<HTMLElement>("[data-card3d]")?.dataset.card3d;
      if (card) {
        const { cards, set, onPick } = latest.current;
        const c = cards[card];
        if (!c) return;
        onPick(card);
        const d = -Math.sign(e.deltaY || e.deltaX);
        if (e.shiftKey) set(card, { width: Math.max(4, Math.min(40, c.width + d * 0.5)) });
        else set(card, { depth: Math.max(-DEPTH, Math.min(DEPTH, c.depth + d * 10)) });
        return;
      }
      setView((v) => ({ ...v, zoom: Math.max(0.2, Math.min(6, v.zoom * Math.exp(-e.deltaY * 0.0015))) }));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  /* Views, Blender's numpad: 1 front, 3 side, 7 top, 0 home, 5 flat. */
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as Element).closest?.("input, textarea")) return;
      const go: Record<string, () => void> = {
        "1": () => setView((v) => ({ ...v, yaw: 0, pitch: 0 })),
        "3": () => setView((v) => ({ ...v, yaw: 90, pitch: 0 })),
        "7": () => setView((v) => ({ ...v, yaw: 0, pitch: 89 })),
        "0": () => setView({ ...HOME, zoom: 1, x: 0, y: 0 }),
        "5": () => setFlat((f) => !f),
        Escape: onClose,
      };
      const f = go[e.key];
      if (!f) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      f();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);

  /* Undo and redo go through the dials' Ctrl+Z; submit posts every
     panel to the dev route, where Claude reads it back into the code. */
  const press = (redo: boolean) =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: redo }));
  const [sent, setSent] = React.useState(false);
  const submit = async () => {
    const ok = await fetch("/api/tune", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: `arrange ${shape}`, values: { text: copyText() } }),
    }).then((r) => r.ok, () => false);
    setSent(ok);
    if (ok) setTimeout(() => setSent(false), 1500);
  };

  const hud: React.CSSProperties = {
    position: "absolute",
    font: "11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
    color: "#ddd",
  };
  const quiet: React.CSSProperties = { background: "none", border: 0, padding: 0, color: "inherit", font: "inherit", cursor: "default" };
  const at = (x: number, y: number, z: number) => `translate3d(${x}px, ${y}px, ${z}px)`;
  const zs = (z: number) => z * zScale;
  const front = DEPTH + 40; // in front of the furthest forward a card can go, so no card carries it
  const { w: W, h: H } = scene.screen;

  return createPortal(
    <div
      ref={root}
      className="hero-3d"
      onPointerDown={orbit}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483600,
        background: "radial-gradient(ellipse at 50% 40%, #262626, #141414 75%)",
        overflow: "hidden",
        perspective: flat ? "none" : `${Math.max(size.w, size.h) * 1.6}px`,
        cursor: "default",
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {/* The stage: the scene turned and zoomed about the middle. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transformStyle: "preserve-3d",
          transform: `translate(${view.x}px, ${view.y}px) scale(${S}) rotateX(${view.pitch}deg) rotateY(${view.yaw}deg)`,
        }}
      >
        {/* The screen, depth 0: a grid every tenth, framed. */}
        <div
          style={{
            position: "absolute",
            width: W,
            height: H,
            transform: at(-W / 2, -H / 2, 0),
            border: `${1 / S}px solid rgb(255 255 255 / 0.35)`,
            backgroundImage:
              "linear-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.07) 1px, transparent 1px)",
            backgroundSize: `${W / 10}px ${H / 10}px`,
          }}
        >
          <span style={{ ...hud, left: 6, top: 4, fontSize: 11 / S, opacity: 0.5 }}>screen · z 0</span>
        </div>

        {/* The axes through the middle. */}
        <div style={{ position: "absolute", width: W * 0.62, height: 2 / S, background: RED, transform: at(0, 0, 0), transformOrigin: "0 0" }} />
        <div style={{ position: "absolute", width: H * 0.62, height: 2 / S, background: GREEN, transform: `${at(0, 0, 0)} rotateZ(90deg)`, transformOrigin: "0 0" }} />
        <div style={{ position: "absolute", width: zs(DEPTH) + 60, height: 2 / S, background: BLUE, transform: `${at(0, 0, 0)} rotateY(-90deg)`, transformOrigin: "0 0" }} />

        {scene.items.map((it) => {
          const c = cards[it.card];
          const z = zs(c?.depth ?? 0);
          const on = it.card === picked;
          /* In front of the picked card: faded and clicked through, so
             one further back can be worked on. */
          const ahead = !on && picked != null && cards[picked] != null && (c?.depth ?? 0) > cards[picked].depth;
          return (
            <React.Fragment key={it.card}>
              {/* The pin: from the screen to the card, its depth. */}
              <div
                style={{
                  position: "absolute",
                  width: Math.abs(z),
                  height: 1 / S,
                  background: on ? PICK : "rgb(255 255 255 / 0.3)",
                  transform: `${at(it.x, it.y, 0)} rotateY(${z >= 0 ? -90 : 90}deg)`,
                  transformOrigin: "0 0",
                }}
              />
              <div style={{ position: "absolute", width: 6 / S, height: 6 / S, borderRadius: "50%", background: on ? PICK : "rgb(255 255 255 / 0.5)", transform: at(it.x - 3 / S, it.y - 3 / S, 0) }} />
              <div
                data-card3d={it.card}
                onPointerDown={(e) => moveCard(e, it.card)}
                style={{
                  position: "absolute",
                  ...(ahead ? { opacity: 0.3, pointerEvents: "none" as const } : null),
                  width: it.w,
                  height: it.h,
                  transform: at(it.x - it.w / 2, it.y - it.h / 2, z),
                  backgroundImage: it.src ? `url("${it.src}")` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#333",
                  outline: `${(on ? 2 : 1) / S}px solid ${on ? PICK : "rgb(255 255 255 / 0.35)"}`,
                  cursor: "default",
                }}
              >
                <span
                  style={{
                    ...hud,
                    left: 0,
                    top: 0,
                    fontSize: 11 / S,
                    padding: `${1 / S}px ${4 / S}px`,
                    background: on ? PICK : "rgb(0 0 0 / 0.7)",
                    color: on ? "#000" : "#fff",
                  }}
                >
                  {it.card.replace("card ", "")} · z {c?.depth ?? 0}
                </span>
              </div>
              {/* The picked card's arrows: drag one to move along it alone. */}
              {on
                ? ([
                    [0, RED, ""],
                    [1, GREEN, "rotateZ(90deg)"],
                    [2, BLUE, "rotateY(-90deg)"],
                  ] as const).map(([axis, color, turn]) => (
                    <div
                      key={axis}
                      title={["X: across", "Y: up and down", "Z: forward and back"][axis]}
                      onPointerDown={(e) => moveAxis(e, it.card, axis)}
                      style={{
                        position: "absolute",
                        width: 110 / S,
                        height: 32 / S, // the grab, wider than the line drawn
                        transform: `${at(it.x, it.y - 16 / S, z + 1)} ${turn}`,
                        transformOrigin: `0 ${16 / S}px`,
                        cursor: "default",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1, height: 3 / S, background: color }} />
                      <div style={{ width: 0, height: 0, borderTop: `${8 / S}px solid transparent`, borderBottom: `${8 / S}px solid transparent`, borderLeft: `${16 / S}px solid ${color}` }} />
                    </div>
                  ))
                : null}
              {/* The picked card's corner: drag out or in to scale it. */}
              {on ? (
                <div
                  title="Scale: drag the corner"
                  onPointerDown={(e) => scaleCard(e, it.card, it.w)}
                  style={{
                    position: "absolute",
                    width: 40 / S, // the grab; the square drawn is 16
                    height: 40 / S,
                    transform: at(it.x + it.w / 2 - 20 / S, it.y + it.h / 2 - 20 / S, z + 1),
                    display: "grid",
                    placeItems: "center",
                    cursor: "default",
                  }}
                >
                  <div style={{ width: 16 / S, height: 16 / S, background: PICK }} />
                </div>
              ) : null}
            </React.Fragment>
          );
        })}

        {/* The middle, one pane, in front of every card. */}
        {scene.middle ? (() => {
          /* Drawn in front, perspective blows it up: shrunk back so that
             from the front it covers what it covers on the page (the
             stage's scale() leaves z alone, so z goes in unscaled). */
          const k = flat ? 1 : Math.max(0.1, 1 - zs(front) / (Math.max(size.w, size.h) * 1.6));
          const mw = scene.middle.w * k;
          const mh = scene.middle.h * k;
          return (
          <div
            style={{
              position: "absolute",
              pointerEvents: "none", // cards behind it stay in reach; its label moves it
              width: mw,
              height: mh,
              transform: at(scene.middle.x * k - mw / 2, scene.middle.y * k - mh / 2, zs(front)),
              background: "rgb(236 236 236 / 0.25)",
              color: "#fff",
              border: `${1 / S}px solid rgb(255 255 255 / 0.9)`,
              boxShadow: `0 ${8 / S}px ${30 / S}px rgb(0 0 0 / 0.5)`,
              display: "grid",
              placeItems: "center",
              cursor: "default",
            }}
          >
            <span
              title="Drag to move the name block"
              onPointerDown={moveMid}
              style={{ ...hud, position: "static", color: "#fff", fontSize: 12 / S, textAlign: "center", pointerEvents: "auto", padding: `${8 / S}px ${14 / S}px`, background: "rgb(0 0 0 / 0.35)" }}
            >
              name · role · buttons
              <br />
              <span style={{ opacity: 0.6 }}>always in front</span>
            </span>
          </div>
          );
        })() : null}
      </div>

      {/* The heads-up: what is showing, the views, the depth scale. */}
      <div data-hud style={{ ...hud, left: 12, top: 12, opacity: 0.75 }}>
        3d · {shape} · {flat ? "flat" : "perspective"}
      </div>
      <div data-hud style={{ ...hud, right: 12, top: 12, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <Gizmo yaw={view.yaw} pitch={view.pitch} onView={(yaw, pitch) => setView((v) => ({ ...v, yaw, pitch }))} />
        <div style={{ display: "flex", gap: 10 }}>
          {([["front", 0, 0], ["side", 90, 0], ["top", 0, 89]] as const).map(([name, yaw, pitch]) => (
            <button key={name} type="button" style={{ ...quiet, opacity: view.yaw === yaw && view.pitch === pitch ? 1 : 0.5 }} onClick={() => setView((v) => ({ ...v, yaw, pitch }))}>
              {name}
            </button>
          ))}
          <button type="button" style={{ ...quiet, opacity: 0.5 }} onClick={() => setView({ ...HOME, zoom: 1, x: 0, y: 0 })}>
            home
          </button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" style={{ ...quiet, opacity: flat ? 1 : 0.5 }} onClick={() => setFlat(!flat)}>
            flat
          </button>
          <span
            title="depth drawn larger than it is: drag sideways"
            onPointerDown={(e) => {
              const z0 = zScale;
              drag(e, (dx) => setZScale(Math.max(1, Math.min(8, Math.round((z0 + dx / 40) * 2) / 2))));
            }}
            style={{ cursor: "default" }}
          >
            <span style={{ opacity: 0.5 }}>z ×</span>
            {zScale}
          </span>
          <button type="button" style={{ ...quiet, opacity: help ? 1 : 0.5 }} onClick={() => setHelp(!help)}>
            ?
          </button>
          <button type="button" style={{ ...quiet, opacity: 0.5 }} onClick={() => press(false)} title="Ctrl+Z">
            undo
          </button>
          <button type="button" style={{ ...quiet, opacity: 0.5 }} onClick={() => press(true)} title="Ctrl+Shift+Z">
            redo
          </button>
          <button type="button" style={{ ...quiet, opacity: sent ? 1 : 0.5 }} onClick={submit}>
            {sent ? "sent" : "submit"}
          </button>
          <button type="button" style={{ ...quiet, opacity: 0.5 }} onClick={onClose}>
            close
          </button>
        </div>
      </div>
      {typeof window !== "undefined" && (window as { __setSize?: SetSize }).__setSize ? (
        <div data-hud style={{ ...hud, left: 12, top: 34, display: "flex", flexDirection: "column", gap: 2 }}>
          {SIZES.map(([name, w, h]) => (
            <button
              key={name}
              type="button"
              style={{ ...quiet, textAlign: "left", opacity: size.w === w && size.h === h ? 1 : 0.5 }}
              onClick={() => (window as unknown as { __setSize: SetSize }).__setSize(w, h)}
            >
              {name} <span style={{ opacity: 0.6 }}>{w}×{h}</span>
            </button>
          ))}
        </div>
      ) : null}
      {help ? (
        <div data-hud style={{ ...hud, left: 12, bottom: 12, opacity: 0.6, maxWidth: 420 }}>
          space+drag: orbit · shift or right drag: pan · scroll: zoom
          <br />
          picked: cards in front fade · alt+click: next card back · click empty: let go
          <br />
          drag a card: move it on the screen · scroll a card: forward/back · shift+scroll or the corner: size
          <br />
          drag an arrow: one axis · 1 front · 3 side · 7 top · 0 home · 5 flat · esc close
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

/** The axes as Blender draws them in the corner, turned with the view;
    click an end to look down that axis. */
function Gizmo({ yaw, pitch, onView }: { yaw: number; pitch: number; onView: (yaw: number, pitch: number) => void }) {
  const R = 26;
  const b = rad(yaw);
  const a = rad(pitch);
  const p = ([x, y, z]: [number, number, number]) => {
    const x1 = x * Math.cos(b) + z * Math.sin(b);
    const z1 = -x * Math.sin(b) + z * Math.cos(b);
    return { x: x1 * R, y: (y * Math.cos(a) - z1 * Math.sin(a)) * R, z: y * Math.sin(a) + z1 * Math.cos(a) };
  };
  const axes = [
    { name: "X", color: RED, v: p([1, 0, 0]), view: [-90, 0] as const },
    { name: "Y", color: GREEN, v: p([0, -1, 0]), view: [0, 89] as const },
    { name: "Z", color: BLUE, v: p([0, 0, 1]), view: [0, 0] as const },
  ].sort((m, n) => m.v.z - n.v.z);
  return (
    <svg width={R * 2 + 20} height={R * 2 + 20} viewBox={`${-R - 10} ${-R - 10} ${R * 2 + 20} ${R * 2 + 20}`} style={{ overflow: "visible" }}>
      <circle r={R + 8} fill="rgb(255 255 255 / 0.05)" />
      {axes.map((ax) => (
        <g key={ax.name} style={{ cursor: "default" }} onClick={() => onView(ax.view[0], ax.view[1])}>
          <line x1={0} y1={0} x2={ax.v.x} y2={ax.v.y} stroke={ax.color} strokeWidth={2} />
          <circle cx={ax.v.x} cy={ax.v.y} r={7} fill={ax.color} />
          <text x={ax.v.x} y={ax.v.y + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#111">
            {ax.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
