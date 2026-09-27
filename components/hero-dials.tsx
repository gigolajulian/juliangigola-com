"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  DialRoot,
  useDialKit,
  useDialKitController,
  type DialConfig,
  type DialPadConfig,
} from "dialkit";
import "dialkit/styles.css";
import { WarpText } from "@/components/warp-text";
import { NAME_WARP } from "@/lib/name-warp";
import { DEAL, SLOTS } from "@/lib/cover-slots";

/* ── the hero on DialKit ──────────────────────────────────────────
 * Julian: tune almost everything about the cover live, on DialKit's
 * panels. The panels only mount on the dev server (DialRoot renders
 * nothing in production), and every default here is the cover as it
 * stands, so nothing moves until a slider does.
 *
 * Most values reach the page as CSS variables on `.cover-float`, which
 * the stylesheet reads with today's values as fallbacks. The rest (the
 * spring, the space's turn, the name's warp, the waits the line under the
 * name keeps) are read by the components that run them, each calling the
 * same panel by its `id`. The copy button on a panel puts its values on
 * the clipboard to paste back.
 * ─────────────────────────────────────────────────────────────── */

export const CARDS = {
  spring: { type: "spring", visualDuration: 0.6, bounce: 0 },
  scale: [1.045, 1, 1.2, 0.005],
  lift: [64, 0, 200, 1],
  shadow: { blur: [5, 0, 80, 1], opacity: [0.41, 0, 1, 0.01] },
  others: { blur: [0.6, 0, 8, 0.1], glass: [0.75, 0, 1, 0.05] },
  waits: {
    focus: [250, 0, 1000, 10],
    blur: [600, 0, 2000, 10],
    release: [280, 0, 1000, 10],
  },
} satisfies DialConfig;

export const SPACE = {
  turnX: [4, 0, 20, 0.5],
  turnY: [9.5, 0, 30, 0.5],
  follow: [16, 1, 50, 1],
  perspective: [2010, 300, 4000, 10],
} satisfies DialConfig;

const ENTRANCE = {
  start: [1180, 0, 3000, 10],
  spread: [0.95, 0, 4, 0.05],
  fly: { distance: [95, 0, 300, 1], duration: [1200, 200, 4000, 10] },
  fade: { duration: [1500, 100, 4000, 10], blur: [14, 0, 40, 1] },
  text: { duration: [900, 100, 3000, 10] },
} satisfies DialConfig;

const NAME = {
  size: [104, 40, 200, 1],
  warpStrength: [NAME_WARP.warpStrength, 0, 0.6, 0.01],
  warpScale: [NAME_WARP.warpScale, 0.2, 5, 0.05],
  speed: [NAME_WARP.speed, 0, 2, 0.01],
  lensRadius: [NAME_WARP.pointerInfluence, 0.1, 3, 0.05],
  lensStrength: [NAME_WARP.pointerStrength, 0, 1.5, 0.01],
  colorSplit: [NAME_WARP.refraction, 0, 0.1, 0.001],
  ripple: [NAME_WARP.ripple, 0, 4, 0.05],
} satisfies DialConfig;

/* Julian: move each card, and pull the field in. Each card has a pad for
   where it sits (left and top as a share of the cover; the pad's y runs
   upward, so it holds the top negated), its width in vw and its depth.
   `pull` draws every card toward the middle across and down: 1 is the
   layout as it stands. */
type Slot = {
  place: DialPadConfig;
  width: [number, number, number, number];
  depth: [number, number, number, number];
};
const LAYOUT = {
  /* Julian: move the cards by hand. On, a card drags where it should go,
     the wheel over it sizes it, shift and the wheel sets its depth, and
     the panel's numbers follow. Links and the space's turn wait. */
  arrange: false,
  shuffle: { type: "action", label: "Shuffle photos" },
  pull: { width: [1, 0.3, 1.5, 0.01], height: [1, 0.3, 1.5, 0.01] },
  cards: Object.fromEntries(
    SLOTS.map((s, i) => [
      `card ${i + 1}`,
      {
        place: {
          type: "pad",
          x: [s.x, -15, 105, 0.5],
          y: [-s.y, -100, 15, 0.5],
          labels: { x: "left", y: "top" },
        },
        width: [s.w, 4, 30, 0.5],
        depth: [s.z, -200, 200, 1],
      },
    ]),
  ) as Record<string, Slot>,
} satisfies DialConfig;

const TYPE = {
  title: { size: [15.5, 9, 24, 0.5], tracking: [0.2, 0, 0.5, 0.01] },
  where: { size: [14.5, 9, 20, 0.5] },
  buttons: { size: [11, 8, 16, 0.5] },
} satisfies DialConfig;

export const useCards = () =>
  useDialKit("Hero cards", CARDS, { id: "hero-cards" });
export const useSpace = () =>
  useDialKit("Hero space", SPACE, { id: "hero-space" });

/** The photographs dealt into the places again, at random. */
const shuffled = (deal: number[]) => {
  const next = [...deal];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

/** A value as a ref, for effects that run once and read it each frame. */
export function useLatest<T>(value: T) {
  const ref = React.useRef(value);
  React.useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** The panels, and the variables they set on the cover. Mounted once,
    outside the frames: inside one, the panel's clicks bubbled up React's
    tree to that frame's link and went to the project. */
export function HeroDials() {
  const ref = React.useRef<HTMLSpanElement>(null);
  const cover = () => ref.current?.closest<HTMLElement>(".cover-float");
  /* Julian: one panel on top (registered first, so listed first) with the two buttons: replay, and one copy
     of every panel's values to paste back in one go. */
  const all = React.useRef({});
  useDialKit(
    "Hero",
    {
      replay: { type: "action", label: "Replay entrance" },
      copy: { type: "action", label: "Copy all values" },
    },
    {
      id: "hero",
      onAction: (action) => {
        if (action === "replay") return replay();
        void navigator.clipboard.writeText(
          JSON.stringify(all.current, null, 2),
        );
      },
    },
  );

  const cards = useCards();
  const space = useSpace();
  const type = useDialKit("Hero type", TYPE, { id: "hero-type" });
  const entrance = useDialKit("Hero entrance", ENTRANCE, {
    id: "hero-entrance",
  });
  const name = useDialKit("Hero name", NAME, { id: "hero-name" });
  /* Which place each photograph takes (`DEAL`); Shuffle deals again. */
  const [deal, setDeal] = React.useState(DEAL);
  const kit = useDialKitController("Hero layout", LAYOUT, {
    id: "hero-layout",
    onAction: (action) => {
      if (action.endsWith("shuffle")) setDeal(shuffled);
    },
  });
  const layout = kit.values;
  /* The controller is new each render; the arrange listeners outlive that. */
  const kitRef = useLatest(kit);
  React.useEffect(() => {
    all.current = {
      cards,
      space,
      name,
      entrance,
      type,
      layout: { ...layout, deal: deal.map((d) => d + 1) },
    };
  });

  /* Run the entrance again, forced: drop every animation on the cover for
     a frame and hand them back, so they start over from nothing with the
     values as they are now. */
  const replay = React.useCallback(() => {
    const el = ref.current?.closest<HTMLElement>(".cover-float");
    if (!el) return;
    const all = el.querySelectorAll<HTMLElement>(
      ".cover-float-frame, .cover-float-card, .lift",
    );
    all.forEach((e) => (e.style.animation = "none"));
    void el.offsetWidth;
    all.forEach((e) => (e.style.animation = ""));
  }, []);

  /* Julian: and on its own whenever an entrance value moves, a beat after
     the slider stops, so every change is seen from the top. */
  const key = JSON.stringify(entrance);
  const seen = React.useRef(key);
  React.useEffect(() => {
    if (key === seen.current) return;
    seen.current = key;
    const t = setTimeout(replay, 350);
    return () => clearTimeout(t);
  }, [key, replay]);

  React.useEffect(() => {
    const el = cover();
    if (!el) return;
    const vars: Record<string, string> = {
      "--focus-wait": `${cards.waits.focus}ms`,
      "--blur-wait": `${cards.waits.blur}ms`,
      "--release-wait": `${cards.waits.release}ms`,
      "--h-lift": `${cards.lift}px`,
      "--h-others-blur": `${cards.others.blur}px`,
      "--h-glass": `${cards.others.glass}`,
      "--h-perspective": `${space.perspective}px`,
      "--h-start": `${entrance.start}ms`,
      "--h-spread": `${entrance.spread}ms`,
      "--h-fly": `${entrance.fly.distance}px`,
      "--h-fly-ms": `${entrance.fly.duration}ms`,
      "--h-fade-ms": `${entrance.fade.duration}ms`,
      "--h-fade-blur": `${entrance.fade.blur}px`,
      "--h-lift-ms": `${entrance.text.duration}ms`,
      "--h-title-size": `${type.title.size}px`,
      "--h-title-track": `${type.title.tracking}em`,
      "--h-where-size": `${type.where.size}px`,
      "--h-cta-size": `${type.buttons.size}px`,
    };
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
    el.style.setProperty("--h-pull-x", `${layout.pull.width}`);
    el.style.setProperty("--h-pull-y", `${layout.pull.height}`);
    /* Each card's place, over the one the server gave it. */
    el.querySelectorAll<HTMLElement>(".cover-float-frame").forEach((f, i) => {
      const card = `card ${(deal[i] ?? i) + 1}`;
      const c = layout.cards[card];
      if (!c) return;
      f.dataset.card = card;
      f.style.setProperty("--x", `${c.place.x}%`);
      f.style.setProperty("--y", `${-c.place.y}%`);
      f.style.setProperty("--w", `${c.width}vw`);
      f.style.setProperty("--z", `${c.depth}px`);
    });
  });

  /* Arrange: the cards moved on the page itself. The listeners sit on the
     cover, below the strip, so a drag or a wheel over a card stops there
     and never pages the strip. */
  const arrange = layout.arrange;
  React.useEffect(() => {
    const el = ref.current?.closest<HTMLElement>(".cover-float");
    if (!el || !arrange) return;
    el.dataset.arrange = "";
    const at = (e: Event) =>
      (e.target as Element).closest<HTMLElement>(".cover-float-frame");
    const step = (v: number, s: number) => Math.round(v / s) * s;
    const clamp = (v: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, v));
    const set = (card: string, slot: Partial<Slot>) =>
      kitRef.current.setValues({ cards: { [card]: slot } } as never);
    let drag: {
      card: string;
      px: number;
      py: number;
      x: number;
      y: number;
    } | null = null;
    const down = (e: PointerEvent) => {
      const f = at(e);
      if (!f?.dataset.card) return;
      e.preventDefault();
      e.stopPropagation();
      const c = kitRef.current.getValues().cards[f.dataset.card];
      drag = {
        card: f.dataset.card,
        px: e.clientX,
        py: e.clientY,
        x: c.place.x,
        y: -c.place.y,
      };
      f.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      const { pull } = kitRef.current.getValues();
      const x = drag.x + ((e.clientX - drag.px) / r.width) * 100 / pull.width;
      const y = drag.y + ((e.clientY - drag.py) / r.height) * 100 / pull.height;
      set(drag.card, {
        place: { x: step(clamp(x, -15, 105), 0.5), y: -step(clamp(y, -15, 100), 0.5) },
      } as never);
    };
    const up = (e: PointerEvent) => {
      if (drag) e.stopPropagation();
      drag = null;
    };
    const wheel = (e: WheelEvent) => {
      const f = at(e);
      if (!f?.dataset.card) return;
      e.preventDefault();
      e.stopPropagation();
      const c = kitRef.current.getValues().cards[f.dataset.card];
      const d = -Math.sign(e.deltaY || e.deltaX);
      if (e.shiftKey) {
        set(f.dataset.card, { depth: clamp(c.depth + d * 5, -200, 200) } as never);
      } else {
        set(f.dataset.card, { width: clamp(c.width + d * 0.5, 4, 30) } as never);
      }
    };
    /* A card is a link: not while arranging. */
    const stop = (e: Event) => {
      if (!at(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("click", stop);
    el.addEventListener("dragstart", stop);
    return () => {
      delete el.dataset.arrange;
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("click", stop);
      el.removeEventListener("dragstart", stop);
    };
  }, [arrange, kitRef]);

  return (
    <>
      <span ref={ref} hidden />
      <DialRoot position="top-right" />
    </>
  );
}

/** The name, through WarpText, on the "Hero name" panel. */
export function HeroName({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  /* The same panel as `HeroDials` reads for its copy. */
  const n = useDialKit("Hero name", NAME, { id: "hero-name" });
  return (
    <WarpText
      text="Julian Gigola"
      fontFamily="var(--font-display)"
      fontWeight={900}
      fontSize="1em"
      letterSpacing="-0.045em"
      warpStrength={n.warpStrength}
      warpScale={n.warpScale}
      speed={n.speed}
      pointerInfluence={n.lensRadius}
      pointerStrength={n.lensStrength}
      refraction={n.colorSplit}
      ripple={n.ripple}
      className={className}
      style={{ ...style, fontSize: `clamp(44px, 10vw, ${n.size}px)` }}
    />
  );
}

/**
 * A photograph on the cover, with its hover swell and shadow on a spring
 * from the "Hero cards" panel.
 *
 * It follows the frame's hover, as the stylesheet does, not its own: the
 * card sits forward of the frame in 3D, and the pointer lands on the frame
 * as often as on the card. The swell goes through `--hover-scale` rather
 * than motion's `scale`, which would write `transform` over the
 * stylesheet's move forward.
 */
export function CoverCard({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const cards = useCards();
  const [hover, setHover] = React.useState(false);

  React.useEffect(() => {
    const frame = ref.current?.parentElement;
    if (!frame) return;
    const on = (e: PointerEvent) => e.pointerType === "mouse" && setHover(true);
    const off = () => setHover(false);
    frame.addEventListener("pointerenter", on);
    frame.addEventListener("pointerleave", off);
    return () => {
      frame.removeEventListener("pointerenter", on);
      frame.removeEventListener("pointerleave", off);
    };
  }, []);

  const s = cards.spring;
  return (
    <motion.span
      ref={ref}
      className="cover-float-card"
      initial={{ "--hover-scale": 1 }}
      animate={{
        "--hover-scale": hover ? cards.scale : 1,
        boxShadow: `0 0 ${hover ? cards.shadow.blur : 0}px rgb(0 0 0 / ${cards.shadow.opacity})`,
      }}
      transition={{
        /* The panel can flip the spring to a curve, which motion spells
           without the type. */
        ...(s.type === "easing" ? { duration: s.duration, ease: s.ease } : s),
        /* The waits the stylesheet keeps for the rest of the focus. */
        delay: (hover ? cards.waits.focus : cards.waits.release) / 1000,
      }}
    >
      {children}
    </motion.span>
  );
}
