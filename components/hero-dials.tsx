"use client";

import * as React from "react";
import { motion } from "motion/react";
import { DialRoot, useDialKit, type DialConfig } from "dialkit";
import "dialkit/styles.css";
import { WarpText } from "@/components/warp-text";
import { NAME_WARP } from "@/lib/name-warp";

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
  spread: [1.2, 0, 4, 0.05],
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

const TYPE = {
  title: { size: [15.5, 9, 24, 0.5], tracking: [0.2, 0, 0.5, 0.01] },
  where: { size: [14.5, 9, 20, 0.5] },
  buttons: { size: [11, 8, 16, 0.5] },
} satisfies DialConfig;

export const useCards = () =>
  useDialKit("Hero cards", CARDS, { id: "hero-cards" });
export const useSpace = () =>
  useDialKit("Hero space", SPACE, { id: "hero-space" });

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
  React.useEffect(() => {
    all.current = { cards, space, name, entrance, type };
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
  });

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
