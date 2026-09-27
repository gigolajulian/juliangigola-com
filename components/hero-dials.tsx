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

/* Julian: the names were confusing. Each key is the label DialKit shows
   (it splits camelCase into words), so every one says what it moves. */
export const CARDS = {
  motion: { type: "spring", visualDuration: 0.6, bounce: 0 },
  grow: [1.045, 1, 1.2, 0.005],
  forward: [64, 0, 200, 1],
  towardMiddle: [0.12, 0, 1, 0.01],
  shadow: { blur: [5, 0, 80, 1], opacity: [0.41, 0, 1, 0.01] },
  otherPhotos: { blur: [0.6, 0, 8, 0.1], glassSheen: [0.75, 0, 1, 0.05] },
  delays: {
    comeForward: [80, 0, 1000, 10],
    blurOthers: [600, 0, 2000, 10],
    letGo: [140, 0, 1000, 10],
  },
} satisfies DialConfig;

export const SPACE = {
  tiltUpDown: [8, 0, 20, 0.5],
  tiltSideways: [16.5, 0, 30, 0.5],
  followSpeed: [16, 1, 50, 1],
  perspective: [2490, 300, 4000, 10],
} satisfies DialConfig;

const ENTRANCE = {
  firstPhotoAt: [420, 0, 3000, 10],
  stagger: [0.95, 0, 4, 0.05],
  photosFlyIn: { distance: [150, 0, 300, 1], duration: [1020, 200, 4000, 10] },
  photosFadeIn: { duration: [1110, 100, 4000, 10], blur: [7, 0, 40, 1] },
  textRise: { duration: [1030, 100, 3000, 10] },
} satisfies DialConfig;

const NAME = {
  size: [97, 40, 200, 1],
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
  dragToArrange: false,
  shuffle: { type: "action", label: "Shuffle photos" },
  spread: { width: [1.05, 0.3, 1.5, 0.01], height: [0.94, 0.3, 1.5, 0.01] },
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
  roleLine: { size: [15, 9, 24, 0.5], letterSpacing: [0.17, 0, 0.5, 0.01] },
  location: { size: [14.5, 9, 20, 0.5] },
  buttons: { size: [11, 8, 16, 0.5] },
} satisfies DialConfig;

/** What each panel section changes on the cover, by its title as the
    panel prints it (lowercased). The Card folders are matched apart. */
const DIAL_TARGETS: Record<string, string> = {
  "photo hover": ".cover-float-frame",
  "3d tilt": ".cover-float-frame",
  "text sizes": ".cover-float-title, .cover-float-where, .cover-cta",
  "role line": ".cover-float-title",
  location: ".cover-float-where",
  buttons: ".cover-cta",
  "load animation": ".cover-float-frame, .cover-float-name, .cover-float-title, .cover-float-where, .cover-cta",
  "photos fly in": ".cover-float-frame",
  "photos fade in": ".cover-float-frame",
  "text rise": ".cover-float-name, .cover-float-title, .cover-float-where, .cover-cta",
  "name effect": ".cover-float-name",
  "photo layout": ".cover-float-frame",
  "background wall": ".inquire-wall",
  "right cards": "#where-next",
};

export const useCards = () =>
  useDialKit("Photo hover", CARDS, { id: "hero-cards" });
export const useSpace = () =>
  useDialKit("3D tilt", SPACE, { id: "hero-space" });

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
    "Hero tools",
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
  const type = useDialKit("Text sizes", TYPE, { id: "hero-type" });
  const entrance = useDialKit("Load animation", ENTRANCE, {
    id: "hero-entrance",
  });
  const name = useDialKit("Name effect", NAME, { id: "hero-name" });
  /* Which place each photograph takes (`DEAL`); Shuffle deals again. */
  const [deal, setDeal] = React.useState(DEAL);
  const kit = useDialKitController("Photo layout", LAYOUT, {
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
      "--focus-wait": `${cards.delays.comeForward}ms`,
      "--blur-wait": `${cards.delays.blurOthers}ms`,
      "--release-wait": `${cards.delays.letGo}ms`,
      "--h-lift": `${cards.forward}px`,
      "--h-mid": `${cards.towardMiddle}`,
      "--h-others-blur": `${cards.otherPhotos.blur}px`,
      "--h-glass": `${cards.otherPhotos.glassSheen}`,
      "--h-perspective": `${space.perspective}px`,
      "--h-start": `${entrance.firstPhotoAt}ms`,
      "--h-spread": `${entrance.stagger}ms`,
      "--h-fly": `${entrance.photosFlyIn.distance}px`,
      "--h-fly-ms": `${entrance.photosFlyIn.duration}ms`,
      "--h-fade-ms": `${entrance.photosFadeIn.duration}ms`,
      "--h-fade-blur": `${entrance.photosFadeIn.blur}px`,
      "--h-lift-ms": `${entrance.textRise.duration}ms`,
      "--h-title-size": `${type.roleLine.size}px`,
      "--h-title-track": `${type.roleLine.letterSpacing}em`,
      "--h-where-size": `${type.location.size}px`,
      "--h-cta-size": `${type.buttons.size}px`,
    };
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
    el.style.setProperty("--h-pull-x", `${layout.spread.width}`);
    el.style.setProperty("--h-pull-y", `${layout.spread.height}`);
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
  const arrange = layout.dragToArrange;
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
      const { spread: pull } = kitRef.current.getValues();
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

  /* Julian: hovering a section of the panel draws a yellow box round what
     it changes on the page. The innermost section that names something
     wins; one that does not (Shadow, Delays) falls back to its panel. */
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const el = ref.current?.closest<HTMLElement>(".cover-float");
    if (!el) return;
    const layer = document.createElement("div");
    layer.style.cssText = "position:fixed;inset:0;z-index:9998;pointer-events:none";
    document.body.append(layer);
    let on: string | null = null;
    let raf = 0;
    const draw = () => {
      // The page, not the cover: the wall is on the last page.
      const boxes = on ? [...document.querySelectorAll<HTMLElement>(on)] : [];
      while (layer.children.length > boxes.length) layer.lastChild!.remove();
      boxes.forEach((b, i) => {
        const r = b.getBoundingClientRect();
        const box = (layer.children[i] as HTMLElement | undefined) ?? layer.appendChild(document.createElement("div"));
        box.style.cssText = `position:absolute;left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;outline:2px solid #ffd400;background:rgb(255 212 0 / 0.08)`;
      });
      /* The cards drift and turn under it, so the boxes follow each frame. */
      raf = on ? requestAnimationFrame(draw) : 0;
    };
    const over = (e: PointerEvent) => {
      let next: string | null = null;
      for (
        let f: Element | null | undefined = (e.target as Element).closest?.(".dialkit-folder");
        f && !next;
        f = f.parentElement?.closest(".dialkit-folder")
      ) {
        const title = f
          .querySelector(":scope > .dialkit-folder-header .dialkit-folder-title")
          ?.textContent?.trim()
          .toLowerCase();
        if (!title) continue;
        next = /^card \d+$/.test(title)
          ? `.cover-float-frame[data-card="${title}"]`
          : (DIAL_TARGETS[title] ?? null);
      }
      if (next === on) return;
      on = next;
      if (on && !raf) raf = requestAnimationFrame(draw);
      if (!on) draw();
    };
    document.addEventListener("pointerover", over);
    return () => {
      document.removeEventListener("pointerover", over);
      cancelAnimationFrame(raf);
      layer.remove();
    };
  }, []);

  return (
    <>
      <span ref={ref} hidden />
      <DialRoot position="top-right" />
    </>
  );
}

/** The name, through WarpText, on the "Name effect" panel. */
export function HeroName({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  /* The same panel as `HeroDials` reads for its copy. */
  const n = useDialKit("Name effect", NAME, { id: "hero-name" });
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
 * from the "Photo hover" panel.
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
    const on = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      /* The way from this card to the cover's centre, for the stylesheet
         to take a share of (Toward Middle). Measured off the frame, which
         does not move on hover. */
      const card = ref.current;
      const cover = frame.closest(".cover-float")?.getBoundingClientRect();
      if (card && cover) {
        const f = frame.getBoundingClientRect();
        card.style.setProperty("--mid-x", `${cover.left + cover.width / 2 - (f.left + f.width / 2)}px`);
        card.style.setProperty("--mid-y", `${cover.top + cover.height / 2 - (f.top + f.height / 2)}px`);
      }
      setHover(true);
    };
    const off = () => setHover(false);
    frame.addEventListener("pointerenter", on);
    frame.addEventListener("pointerleave", off);
    return () => {
      frame.removeEventListener("pointerenter", on);
      frame.removeEventListener("pointerleave", off);
    };
  }, []);

  const s = cards.motion;
  return (
    <motion.span
      ref={ref}
      className="cover-float-card"
      initial={{ "--hover-scale": 1 }}
      animate={{
        "--hover-scale": hover ? cards.grow : 1,
        boxShadow: `0 0 ${hover ? cards.shadow.blur : 0}px rgb(0 0 0 / ${cards.shadow.opacity})`,
      }}
      transition={{
        /* The panel can flip the spring to a curve, which motion spells
           without the type. */
        ...(s.type === "easing" ? { duration: s.duration, ease: s.ease } : s),
        /* The waits the stylesheet keeps for the rest of the focus. */
        delay: (hover ? cards.delays.comeForward : cards.delays.letGo) / 1000,
      }}
    >
      {children}
    </motion.span>
  );
}
