"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { readNotes, writeNote } from "@/lib/arrange-notes";
import type { Middle } from "@/lib/cover-slots";

/* ── arranging the cover, one photograph at a time ────────────────
 * Julian: a way forward to arrange the cards in 3D space, working on each
 * image directly. With Drag to Arrange on (the "Photo layout" panel), a
 * click picks a card and this inspector takes it: where it sits, its
 * size, its depth, whether it shows, and a note to Claude about it. The
 * depth line along the top is the field seen from the side, every card
 * on it by how far forward it stands; drag a card's chip to move it
 * forward or back, click one to pick it (the hidden ones too). Tilt
 * turns the field so the depth can be seen. It edits the layout the
 * window is showing, as a drag does. Clicking the name or the text under
 * it picks the middle instead: drag it to move it, the wheel over a part
 * sizes that part, and its values show here. Dev server only.
 * ─────────────────────────────────────────────────────────────── */

export type ArrangeCard = {
  place: { x: number; y: number };
  width: number;
  depth: number;
  show?: boolean;
};

const DEPTH = 200;
const LAYOUT_NAMES: Record<string, string> = {
  large: "Large screens (Photo layout)",
  short: "Wide and short (Photo layout, wide short)",
  landscape: "Small landscape (Photo layout, landscape)",
  upright: "Tablet upright (Photo layout, upright)",
  phone: "Phones (Photo layout, phone)",
  sideways: "Phone sideways (Photo layout, sideways)",
};

const n = (v: number, d = 1) => Number(v.toFixed(d));

export function ArrangeInspector({
  shape,
  cards,
  picked,
  onPick,
  set,
  photoOf,
  middle,
  setMiddle,
  tilt,
  onTilt,
  view3d,
  onView3d,
}: {
  shape: string;
  cards: Record<string, ArrangeCard>;
  picked: string | null;
  onPick: (card: string | null) => void;
  set: (card: string, patch: Partial<ArrangeCard>) => void;
  photoOf: (card: string) => string;
  /** The middle's set for the layout showing (`MIDDLE`). */
  middle: Middle;
  setMiddle: (patch: Partial<Middle>) => void;
  tilt: boolean;
  onTilt: (on: boolean) => void;
  /** The 3D view (`hero-3d.tsx`). */
  view3d: boolean;
  onView3d: (on: boolean) => void;
}) {
  const names = Object.keys(cards);
  const c = picked ? cards[picked] : undefined;
  const noteId = picked ? `${shape}:${picked}` : "";
  const [small, setSmall] = React.useState(false);

  /* Keys, while a card is picked and nothing is being typed. */
  const latest = React.useRef({
    picked,
    cards,
    set,
    onPick,
    names,
    middle,
    setMiddle,
  });
  React.useEffect(() => {
    latest.current = { picked, cards, set, onPick, names, middle, setMiddle };
  });
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const { picked, cards, set, onPick, names, middle, setMiddle } =
        latest.current;
      if (!picked || (e.target as Element).closest?.("input, textarea, select"))
        return;
      if (picked === "middle") {
        const step = e.shiftKey ? 2 : 0.5;
        const act: Record<string, () => void> = {
          ArrowLeft: () => setMiddle({ x: n(middle.x - step) }),
          ArrowRight: () => setMiddle({ x: n(middle.x + step) }),
          ArrowUp: () => setMiddle({ y: n(middle.y - step) }),
          ArrowDown: () => setMiddle({ y: n(middle.y + step) }),
          Escape: () => onPick(null),
          Tab: () => onPick(names[e.shiftKey ? names.length - 1 : 0]),
        };
        const f = act[e.key];
        if (!f) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        f();
        return;
      }
      const c = cards[picked];
      if (!c) return;
      const step = e.shiftKey ? 2 : 0.5;
      const move = (dx: number, dy: number) =>
        set(picked, { place: { x: n(c.place.x + dx), y: n(c.place.y - dy) } });
      const act: Record<string, () => void> = {
        ArrowLeft: () => move(-step, 0),
        ArrowRight: () => move(step, 0),
        ArrowUp: () => move(0, -step),
        ArrowDown: () => move(0, step),
        "=": () => set(picked, { width: Math.min(40, c.width + 0.5) }),
        "+": () => set(picked, { width: Math.min(40, c.width + 0.5) }),
        "-": () => set(picked, { width: Math.max(4, c.width - 0.5) }),
        "]": () => set(picked, { depth: Math.min(DEPTH, c.depth + 10) }),
        "[": () => set(picked, { depth: Math.max(-DEPTH, c.depth - 10) }),
        h: () => c.show !== undefined && set(picked, { show: !c.show }),
        Escape: () => onPick(null),
        Tab: () => {
          const i = names.indexOf(picked);
          onPick(
            names[(i + (e.shiftKey ? -1 : 1) + names.length) % names.length],
          );
        },
      };
      const f = act[e.key];
      if (!f) return;
      /* Taken before the strip sees it: its arrows page the homepage. */
      e.preventDefault();
      e.stopImmediatePropagation();
      f();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);

  /* The depth line: drag the picked card's chip along it. */
  const track = React.useRef<HTMLDivElement>(null);
  const dragDepth = (e: React.PointerEvent, card: string) => {
    onPick(card);
    const r = track.current!.getBoundingClientRect();
    const at = (x: number) =>
      Math.round(
        Math.max(
          -DEPTH,
          Math.min(DEPTH, ((x - r.left) / r.width) * 2 * DEPTH - DEPTH),
        ),
      );
    const move = (ev: PointerEvent) => set(card, { depth: at(ev.clientX) });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* Julian likes a minimal UI: one quiet block, small mono type, no
     boxes. The values scrub: drag one sideways to change it. */
  const quiet: React.CSSProperties = {
    background: "none",
    border: 0,
    padding: 0,
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
  };
  const scrub = (
    label: string,
    value: number,
    step: number,
    min: number,
    max: number,
    apply: (v: number) => void,
  ) => (
    <span
      title={`${label}: drag sideways`}
      onPointerDown={(e) => {
        e.preventDefault();
        const x0 = e.clientX;
        const v0 = value;
        const move = (ev: PointerEvent) =>
          apply(
            n(
              Math.max(
                min,
                Math.min(max, v0 + Math.round((ev.clientX - x0) / 4) * step),
              ),
            ),
          );
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
      style={{ cursor: "ew-resize", whiteSpace: "nowrap" }}
    >
      <span style={{ opacity: 0.45 }}>{label}</span> {value}
    </span>
  );
  const [help, setHelp] = React.useState(false);
  /* Numbers close in depth stack in rows rather than print over each
     other: each takes the first row with room (6% of the line). */
  const rows = (() => {
    const of: Record<string, number> = {};
    const ends: number[] = [];
    for (const k of [...names].sort(
      (p, q) => cards[p].depth - cards[q].depth,
    )) {
      const at = ((cards[k].depth + DEPTH) / (2 * DEPTH)) * 100;
      let r = ends.findIndex((e) => at - e >= 6);
      if (r < 0) r = ends.push(0) - 1;
      ends[r] = at;
      of[k] = r;
    }
    return { of, count: Math.max(1, ends.length) };
  })();

  return createPortal(
    <div
      className="hero-arrange"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 2147483646,
        width: "min(280px, calc(100vw - 16px))",
        boxSizing: "border-box",
        background: "rgb(12 12 12 / 0.82)",
        backdropFilter: "blur(10px)",
        color: "#eee",
        padding: "8px 10px",
        font: "11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {picked === "middle"
            ? "middle"
            : picked
              ? `${picked.replace("card ", "#")} ${photoOf(picked)}`
              : "pick a photo or the name"}
        </span>
        <button
          type="button"
          style={{ ...quiet, opacity: view3d ? 1 : 0.45 }}
          onClick={() => onView3d(!view3d)}
        >
          3d
        </button>
        <button
          type="button"
          style={{ ...quiet, opacity: tilt ? 1 : 0.45 }}
          onClick={() => onTilt(!tilt)}
        >
          tilt
        </button>
        <button
          type="button"
          style={{ ...quiet, opacity: help ? 1 : 0.45 }}
          onClick={() => setHelp(!help)}
        >
          ?
        </button>
        {/* Folded to this line, so a phone's lower cards can be seen; the
            keys and the scroll still work. */}
        <button
          type="button"
          style={{ ...quiet, opacity: 0.45 }}
          onClick={() => setSmall(!small)}
          aria-label={small ? "Open" : "Fold"}
        >
          {small ? "+" : "–"}
        </button>
      </div>

      {small ? null : (
        <>
          {/* The field from the side: back on the left, forward on the
              right. Drag a number along it; click one to pick it. */}
          <div
            ref={track}
            style={{ position: "relative", height: 14 * rows.count + 2 }}
            title="depth: back ← → forward"
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 7,
                height: 1,
                background: "rgb(255 255 255 / 0.15)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                bottom: 0,
                width: 1,
                background: "rgb(255 255 255 / 0.2)",
              }}
            />
            {names.map((k) => {
              const card = cards[k];
              const on = k === picked;
              return (
                <button
                  key={k}
                  type="button"
                  title={`${k}: ${photoOf(k)}${card.show === false ? " (hidden)" : ""}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    dragDepth(e, k);
                  }}
                  style={{
                    ...quiet,
                    position: "absolute",
                    top: rows.of[k] * 14,
                    left: `${((card.depth + DEPTH) / (2 * DEPTH)) * 100}%`,
                    translate: "-50% 0",
                    lineHeight: "14px",
                    cursor: "ew-resize",
                    color: on ? "#4da3ff" : "#eee",
                    opacity: on ? 1 : card.show === false ? 0.25 : 0.6,
                    fontWeight: on ? 700 : 400,
                    zIndex: on ? 2 : 1,
                  }}
                >
                  {k.replace("card ", "")}
                </button>
              );
            })}
          </div>

          {picked === "middle" ? (
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {scrub("name", middle.name, 0.01, 0.4, 2, (v) =>
                setMiddle({ name: n(v, 2) }),
              )}
              {scrub("role", middle.role, 0.01, 0.4, 2, (v) =>
                setMiddle({ role: n(v, 2) }),
              )}
              {scrub("where", middle.where, 0.01, 0.4, 2, (v) =>
                setMiddle({ where: n(v, 2) }),
              )}
              {scrub("buttons", middle.buttons, 0.01, 0.4, 2, (v) =>
                setMiddle({ buttons: n(v, 2) }),
              )}
              {scrub("x", middle.x, 0.5, -50, 50, (v) => setMiddle({ x: v }))}
              {scrub("y", middle.y, 0.5, -50, 50, (v) => setMiddle({ y: v }))}
            </div>
          ) : null}
          {picked && (c || picked === "middle") ? (
            <>
              {c ? (
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {scrub("z", c.depth, 1, -DEPTH, DEPTH, (v) =>
                    set(picked, { depth: v }),
                  )}
                  {scrub("w", c.width, 0.5, 4, 40, (v) =>
                    set(picked, { width: v }),
                  )}
                  {scrub("x", c.place.x, 0.5, -15, 105, (v) =>
                    set(picked, { place: { x: v, y: c.place.y } }),
                  )}
                  {scrub("y", -c.place.y, 0.5, -15, 100, (v) =>
                    set(picked, { place: { x: c.place.x, y: -v } }),
                  )}
                  {c.show !== undefined ? (
                    <button
                      type="button"
                      style={{ ...quiet, marginLeft: "auto", opacity: 0.6 }}
                      onClick={() => set(picked, { show: !c.show })}
                    >
                      {c.show ? "hide" : "show"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {/* One note per card and layout, holding what was written. */}
              <input
                key={noteId}
                defaultValue={readNotes()[noteId]?.text ?? ""}
                placeholder="note to Claude…"
                onChange={(e) =>
                  writeNote(noteId, {
                    card: picked,
                    photo:
                      picked === "middle"
                        ? "name, role, location, buttons"
                        : photoOf(picked),
                    layout: LAYOUT_NAMES[shape] ?? shape,
                    text: e.target.value,
                  })
                }
                style={{
                  font: "inherit",
                  color: "inherit",
                  background: "none",
                  border: 0,
                  borderBottom: "1px solid rgb(255 255 255 / 0.15)",
                  padding: "2px 0",
                  outline: "none",
                }}
              />
            </>
          ) : null}

          {help ? (
            <div style={{ opacity: 0.55 }}>
              {LAYOUT_NAMES[shape] ?? shape}
              <br />
              drag: move · scroll: forward/back · shift+scroll: size
              <br />
              arrows: nudge (shift: more) · [ ]: depth · + −: size
              <br />
              h: hide · tab: next · esc: done · drag a value to scrub
              <br />
              click the name: the middle · drag it: move · scroll over a part:
              size it
            </div>
          ) : null}
        </>
      )}
    </div>,
    document.body,
  );
}
