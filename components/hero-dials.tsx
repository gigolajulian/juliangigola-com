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
import { useDialKitStyles } from "@/lib/dialkit-styles";
import { highlightDials } from "@/lib/dial-highlight";
import { DialCopyAll, copyText } from "@/components/dial-copy-all";
import { ArrangeInspector, type ArrangeCard } from "@/components/hero-arrange";
import { Hero3D } from "@/components/hero-3d";
import { WarpText } from "@/components/warp-text";
import { NAME_WARP } from "@/lib/name-warp";
import {
  DEAL,
  LANDSCAPE,
  MIDDLE,
  PHONE,
  SIDEWAYS,
  SLOTS,
  UPRIGHT,
  middleVars,
  type Middle,
} from "@/lib/cover-slots";

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
  motion: { type: "spring", visualDuration: 0.3, bounce: 0.2 },
  grow: [1.03, 1, 1.2, 0.005],
  forward: [44, 0, 200, 1],
  towardMiddle: [0.1, 0, 1, 0.01],
  shadow: { blur: [4, 0, 80, 1], opacity: [0.3, 0, 1, 0.01] },
  otherPhotos: { blur: [0.3, 0, 8, 0.1], glassSheen: [0.4, 0, 1, 0.05] },
  delays: {
    comeForward: [10, 0, 1000, 10],
    blurOthers: [310, 0, 2000, 10],
    letGo: [20, 0, 1000, 10],
  },
} satisfies DialConfig;

export const SPACE = {
  tiltUpDown: [9.5, 0, 20, 0.5],
  tiltSideways: [16.5, 0, 30, 0.5],
  followSpeed: [16, 1, 50, 1],
  perspective: [3280, 300, 4000, 10],
} satisfies DialConfig;

const ENTRANCE = {
  firstPhotoAt: [420, 0, 3000, 10],
  stagger: [0.95, 0, 4, 0.05],
  photosFlyIn: { distance: [150, 0, 300, 1], duration: [1020, 200, 4000, 10] },
  photosFadeIn: { duration: [1110, 100, 4000, 10], blur: [7, 0, 40, 1] },
  textRise: { duration: [1030, 100, 3000, 10] },
} satisfies DialConfig;

const NAME = {
  size: [96, 40, 200, 1],
  // Julian's pasted values, the cover's own; About keeps NAME_WARP.
  warpStrength: [0.21, 0, 0.6, 0.01],
  warpScale: [0.8, 0.2, 5, 0.05],
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
     the wheel over it moves it forward or back, shift and the wheel sizes it, and
     the panel's numbers follow. Links and the space's turn wait. */
  dragToArrange: false,
  shuffle: { type: "action", label: "Shuffle photos" },
  spread: { width: [1.05, 0.3, 1.5, 0.01], height: [0.94, 0.3, 1.5, 0.01] },
  cards: cardsOf(SLOTS) as Record<string, Slot>,
} satisfies DialConfig;

/* Julian: the smaller screens arranged on their own. A tablet held
   upright and a short landscape screen (640 to 1279px wide) each have a
   panel of the same cards, with a switch for whether each shows; the
   spread and Drag to Arrange are the main panel's, and a drag moves the
   cards of whichever layout the window is showing. */
type SmallSlot = Slot & { show: boolean };
const UPRIGHT_LAYOUT = {
  cards: cardsOf(UPRIGHT) as Record<string, SmallSlot>,
} satisfies DialConfig;
const LANDSCAPE_LAYOUT = {
  cards: cardsOf(LANDSCAPE) as Record<string, SmallSlot>,
} satisfies DialConfig;
const PHONE_LAYOUT = {
  cards: cardsOf(PHONE) as Record<string, SmallSlot>,
} satisfies DialConfig;
const SIDEWAYS_LAYOUT = {
  cards: cardsOf(SIDEWAYS) as Record<string, SmallSlot>,
} satisfies DialConfig;
/* The same queries as `globals.css`; sideways wins over landscape. */
const UPRIGHT_MQ =
  "(min-width: 40rem) and (max-width: 79.99rem) and (orientation: portrait)";
const LANDSCAPE_MQ =
  "(min-width: 40rem) and (max-width: 79.99rem) and (orientation: landscape)";
const SIDEWAYS_MQ = "(orientation: landscape) and (max-height: 31.99rem)";
const PHONE_MQ = "(max-width: 39.99rem) and (orientation: portrait)";

/** Which layout the window is showing. */
type Shape = "large" | "landscape" | "upright" | "phone" | "sideways";
export const shapeNow = (): Shape =>
  matchMedia(PHONE_MQ).matches
    ? "phone"
    : matchMedia(SIDEWAYS_MQ).matches
      ? "sideways"
      : matchMedia(UPRIGHT_MQ).matches
        ? "upright"
        : matchMedia(LANDSCAPE_MQ).matches
          ? "landscape"
          : "large";

/* Julian arranges across many screen sizes in one tab, and a reload (or
   the dev server's own, on a code change) threw the layouts away. Kept
   for the tab's life, so they survive that and never outlive it to hide a
   new default. */
const keep = (id: string) => ({
  persist: { key: `jg-arrange:${id}`, storage: "sessionStorage" as const },
});

/** A card folder for each place; with a `show` switch where the places
    have one. */
function cardsOf(
  places: { x: number; y: number; w: number; z: number; show?: boolean }[],
) {
  return Object.fromEntries(
    places.map((s, i) => [
      `card ${i + 1}`,
      {
        ...(s.show === undefined ? {} : { _collapsed: true, show: s.show }),
        place: {
          type: "pad",
          x: [s.x, -15, 105, 0.5],
          y: [-s.y, -100, 15, 0.5],
          labels: { x: "left", y: "top" },
        },
        width: [s.w, 4, 40, 0.5],
        depth: [s.z, -200, 200, 1],
      },
    ]),
  );
}

/* Julian: the name, the role, the location and the buttons sized, and the
   middle moved, on each screen shape (`MIDDLE`). The arrange inspector
   edits the set the window is showing. */
const MIDDLE_DIALS = Object.fromEntries(
  Object.entries(MIDDLE).map(([shape, m]) => [
    shape,
    {
      _collapsed: true,
      name: [m.name, 0.4, 2, 0.01],
      role: [m.role, 0.4, 2, 0.01],
      where: [m.where, 0.4, 2, 0.01],
      buttons: [m.buttons, 0.4, 2, 0.01],
      x: [m.x, -50, 50, 0.5],
      y: [m.y, -50, 50, 0.5],
    },
  ]),
) as Record<Shape, Record<keyof Middle, [number, number, number, number]> & { _collapsed: boolean }>;

const TYPE = {
  roleLine: { size: [16, 9, 24, 0.5], letterSpacing: [0.15, 0, 0.5, 0.01] },
  location: { size: [14, 9, 20, 0.5] },
  buttons: { size: [12, 8, 16, 0.5] },
  /* Julian: how close the name, the role, the location and the buttons
     sit, in px of space between each and the next. */
  /* Julian: the size of the whole middle (name, role, location and
     buttons together) and where it starts: px down from the middle of
     the cover, negative up. */
  middle: {
    size: [0.99, 0.5, 1.6, 0.01],
    moveDown: [22, -300, 300, 1],
  },
  spacing: {
    nameToRole: [5, 0, 80, 1],
    roleToLocation: [8, 0, 80, 1],
    locationToButtons: [19, 0, 80, 1],
  },
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
  spacing:
    ".cover-float-name, .cover-float-title, .cover-float-where, .cover-cta",
  middle: ".cover-float-middle",
  "load animation":
    ".cover-float-frame, .cover-float-name, .cover-float-title, .cover-float-where, .cover-cta",
  "photos fly in": ".cover-float-frame",
  "photos fade in": ".cover-float-frame",
  "text rise":
    ".cover-float-name, .cover-float-title, .cover-float-where, .cover-cta",
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
  useDialKitStyles();
  const cover = () => ref.current?.closest<HTMLElement>(".cover-float");
  /* Julian: one panel on top (registered first, so listed first) with the two buttons: replay, and one copy
     of every panel's values to paste back in one go. */
  /* Which place each photograph takes, for the copy: Shuffle's deal
     lives here and not on a panel. */
  const all = React.useRef({ deal: DEAL });
  useDialKit(
    "Hero tools",
    {
      replay: { type: "action", label: "Replay entrance" },
      copy: { type: "action", label: "Copy all values" },
    },
    {
      id: "hero",
      onAction: (action) => {
        if (action.endsWith("replay")) return replay();
        /* Julian kept pasting this panel's own copy, which holds only its
           two buttons. The button copies what "Copy all" does: every
           panel and the notes, in the paste that bakes them in. */
        const { deal } = all.current;
        const shuffled = deal.some((d, i) => d !== i);
        void navigator.clipboard.writeText(
          copyText() +
            (shuffled ? `

"Photo layout" deal (1-based): ${JSON.stringify(deal.map((d) => d + 1))}` : ""),
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
  // Registered here too, so the panel is listed in its place.
  useDialKit("Name effect", NAME, { id: "hero-name" });
  /* Which place each photograph takes (`DEAL`); Shuffle deals again. */
  const [deal, setDeal] = React.useState(DEAL);
  const kit = useDialKitController("Photo layout", LAYOUT, {
    id: "hero-layout",
    ...keep("hero-layout"),
    onAction: (action) => {
      if (action.endsWith("shuffle")) setDeal(shuffled);
    },
  });
  const layout = kit.values;
  const upright = useDialKitController(
    "Photo layout, upright",
    UPRIGHT_LAYOUT,
    {
      id: "hero-layout-upright",
      ...keep("hero-layout-upright"),
    },
  );
  const landscape = useDialKitController(
    "Photo layout, landscape",
    LANDSCAPE_LAYOUT,
    {
      id: "hero-layout-landscape",
      ...keep("hero-layout-landscape"),
    },
  );
  const phone = useDialKitController("Photo layout, phone", PHONE_LAYOUT, {
    id: "hero-layout-phone",
    ...keep("hero-layout-phone"),
  });
  const sideways = useDialKitController(
    "Photo layout, sideways",
    SIDEWAYS_LAYOUT,
    {
      id: "hero-layout-sideways",
      ...keep("hero-layout-sideways"),
    },
  );
  const middle = useDialKitController("Middle by screen", MIDDLE_DIALS, {
    id: "hero-middle",
    ...keep("hero-middle"),
  });
  const mids = middle.values as unknown as Record<Shape, Middle>;
  const layouts = { large: kit, upright, landscape, phone, sideways };
  /* The arrange inspector (`hero-arrange.tsx`): the layout showing, the
     card picked, and the field tilted to see its depth. */
  const [shape, setShape] = React.useState<Shape>("large");
  React.useEffect(() => {
    const on = () => setShape(shapeNow());
    on();
    const lists = [PHONE_MQ, SIDEWAYS_MQ, UPRIGHT_MQ, LANDSCAPE_MQ].map((q) =>
      matchMedia(q),
    );
    lists.forEach((l) => l.addEventListener("change", on));
    return () => lists.forEach((l) => l.removeEventListener("change", on));
  }, []);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [tilt, setTilt] = React.useState(false);
  const [view3d, setView3d] = React.useState(false);
  /* The controllers are new each render; the arrange listeners outlive
     that. */
  const kitRef = useLatest(kit);
  const uprightRef = useLatest(upright);
  const landscapeRef = useLatest(landscape);
  const phoneRef = useLatest(phone);
  const sidewaysRef = useLatest(sideways);
  const middleRef = useLatest(middle);
  React.useEffect(() => {
    all.current = { deal };
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
      "--h-mid-size": `${type.middle.size}`,
      "--h-mid-down": `${type.middle.moveDown}px`,
      "--h-gap-role": `${type.spacing.nameToRole}px`,
      "--h-gap-where": `${type.spacing.roleToLocation}px`,
      "--h-gap-cta": `${type.spacing.locationToButtons}px`,
    };
    for (const [k, v] of Object.entries({ ...vars, ...middleVars(mids) }))
      el.style.setProperty(k, v);
    // The phone's lines fitted again to the name at its new size.
    window.dispatchEvent(new Event("jg-fit"));
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
      for (const [k, set, off] of [
        ["u", upright.values, "cover-float-off-upright"],
        ["l", landscape.values, "cover-float-off-landscape"],
        ["s", sideways.values, "cover-float-off-sideways"],
      ] as const) {
        const p = set.cards[card];
        if (!p) continue;
        f.style.setProperty(`--${k}x`, `${p.place.x}%`);
        f.style.setProperty(`--${k}y`, `${-p.place.y}%`);
        f.style.setProperty(`--${k}w`, `${p.width}vw`);
        f.style.setProperty(`--${k}z`, `${p.depth}px`);
        f.classList.toggle(off, !p.show);
      }
      const p = phone.values.cards[card];
      if (p) {
        f.style.setProperty("--px", `${p.place.x}%`);
        f.style.setProperty("--py", `${-p.place.y}%`);
        f.style.setProperty("--pw", `${p.width}vw`);
        f.style.setProperty("--pwh", `${(p.width * 13) / 28}svh`);
        f.style.setProperty("--pz", `${p.depth}px`);
        f.classList.toggle("cover-float-off-phone", !p.show);
      }
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
    /* The layout the window is showing: a smaller screen's own, or the
       large one. */
    const active = () =>
      ({
        phone: phoneRef,
        sideways: sidewaysRef,
        upright: uprightRef,
        landscape: landscapeRef,
        large: kitRef,
      })[shapeNow()].current;
    type Card = {
      place: { x: number; y: number };
      width: number;
      depth: number;
    };
    const cardOf = (card: string) =>
      (active().getValues() as unknown as { cards: Record<string, Card> })
        .cards[card];
    const set = (card: string, slot: Partial<Slot>) =>
      active().setValues({ cards: { [card]: slot } } as never);
    const mid = (e: Event) =>
      (e.target as Element).closest<HTMLElement>(".cover-float-middle");
    const setMid = (patch: Partial<Middle>) =>
      middleRef.current.setValues({ [shapeNow()]: patch } as never);
    const midNow = () =>
      (middleRef.current.getValues() as unknown as Record<Shape, Middle>)[
        shapeNow()
      ];
    let moving: { px: number; py: number; x: number; y: number } | null = null;
    let drag: {
      card: string;
      px: number;
      py: number;
      x: number;
      y: number;
    } | null = null;
    const down = (e: PointerEvent) => {
      if (mid(e)) {
        e.preventDefault();
        e.stopPropagation();
        setPicked("middle");
        const m = midNow();
        moving = { px: e.clientX, py: e.clientY, x: m.x, y: m.y };
        mid(e)!.setPointerCapture(e.pointerId);
        return;
      }
      const f = at(e);
      if (!f?.dataset.card) return;
      e.preventDefault();
      e.stopPropagation();
      setPicked(f.dataset.card);
      const c = cardOf(f.dataset.card);
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
      if (moving) {
        e.stopPropagation();
        setMid({
          x: step(
            clamp(
              moving.x + ((e.clientX - moving.px) / innerWidth) * 100,
              -50,
              50,
            ),
            0.5,
          ),
          y: step(
            clamp(
              moving.y + ((e.clientY - moving.py) / innerHeight) * 100,
              -50,
              50,
            ),
            0.5,
          ),
        });
        return;
      }
      if (!drag) return;
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      // A phone places its cards as they are, with no spread.
      const pull = matchMedia(PHONE_MQ).matches
        ? { width: 1, height: 1 }
        : kitRef.current.getValues().spread;
      const x = drag.x + (((e.clientX - drag.px) / r.width) * 100) / pull.width;
      const y =
        drag.y + (((e.clientY - drag.py) / r.height) * 100) / pull.height;
      set(drag.card, {
        place: {
          x: step(clamp(x, -15, 105), 0.5),
          y: -step(clamp(y, -15, 100), 0.5),
        },
      } as never);
    };
    const up = (e: PointerEvent) => {
      if (drag || moving) e.stopPropagation();
      drag = null;
      moving = null;
    };
    const wheel = (e: WheelEvent) => {
      /* Julian: over the middle, the wheel sizes the part under the
         pointer: the name, the role, the location or the buttons. */
      const part =
        mid(e) &&
        (e.target as Element).closest(
          ".cover-float-name, .cover-float-title, .cover-float-where, .cover-float-ctas",
        );
      if (mid(e)) {
        e.preventDefault();
        e.stopPropagation();
        setPicked("middle");
        if (!part) return;
        const k: keyof Middle = part.matches(".cover-float-name")
          ? "name"
          : part.matches(".cover-float-title")
            ? "role"
            : part.matches(".cover-float-where")
              ? "where"
              : "buttons";
        const d = -Math.sign(e.deltaY || e.deltaX);
        setMid({
          [k]: Math.round(clamp(midNow()[k] + d * 0.02, 0.4, 2) * 100) / 100,
        });
        return;
      }
      const f = at(e);
      if (!f?.dataset.card) return;
      e.preventDefault();
      e.stopPropagation();
      setPicked(f.dataset.card);
      const c = cardOf(f.dataset.card);
      const d = -Math.sign(e.deltaY || e.deltaX);
      /* Julian: scrolling over a card moves it in the 3D space, forward
         (up) or back; with shift it sizes the card instead. */
      if (e.shiftKey) {
        set(f.dataset.card, {
          width: clamp(c.width + d * 0.5, 4, 40),
        } as never);
      } else {
        set(f.dataset.card, {
          depth: clamp(c.depth + d * 10, -200, 200),
        } as never);
      }
    };
    /* A card is a link: not while arranging. */
    const stop = (e: Event) => {
      if (!at(e) && !mid(e)) return;
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
      delete el.dataset.tilt;
      el.querySelectorAll("[data-picked]").forEach((f) =>
        f.removeAttribute("data-picked"),
      );
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("click", stop);
      el.removeEventListener("dragstart", stop);
    };
  }, [
    arrange,
    kitRef,
    uprightRef,
    landscapeRef,
    phoneRef,
    sidewaysRef,
    middleRef,
  ]);

  /* The picked card ringed on the page, and the field tilted. */
  React.useEffect(() => {
    const el = cover();
    if (!el || !arrange) return;
    el.querySelectorAll<HTMLElement>(".cover-float-frame").forEach((f) =>
      f.toggleAttribute("data-picked", f.dataset.card === picked),
    );
    el.querySelector(".cover-float-middle")?.toggleAttribute(
      "data-picked",
      picked === "middle",
    );
    el.toggleAttribute("data-tilt", tilt);
  });

  /* Julian: hovering a section of the panel draws a box round what it
     changes on the page (`lib/dial-highlight.ts`). A section that names
     nothing (Shadow, Delays) falls back to its panel. */
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!ref.current?.closest(".cover-float")) return;
    return highlightDials((title) =>
      /^card \d+$/.test(title)
        ? `.cover-float-frame[data-card="${title}"]`
        : (DIAL_TARGETS[title] ?? null),
    );
  }, []);

  return (
    <>
      <span ref={ref} hidden />
      <DialRoot position="top-right" defaultOpen={false} />
      <DialCopyAll />
      {arrange ? (
        <ArrangeInspector
          shape={shape}
          cards={
            layouts[shape].values.cards as unknown as Record<
              string,
              ArrangeCard
            >
          }
          picked={picked}
          onPick={setPicked}
          set={(card, patch) =>
            layouts[shape].setValues({ cards: { [card]: patch } } as never)
          }
          photoOf={(card) =>
            cover()?.querySelector<HTMLElement>(
              `.cover-float-frame[data-card="${card}"]`,
            )?.dataset.photo ?? ""
          }
          middle={mids[shape]}
          setMiddle={(patch) => middle.setValues({ [shape]: patch } as never)}
          tilt={tilt}
          onTilt={setTilt}
          view3d={view3d}
          onView3d={setView3d}
        />
      ) : null}
      {arrange && view3d ? (
        <Hero3D
          cover={cover}
          shape={shape}
          cards={
            layouts[shape].values.cards as unknown as Record<
              string,
              ArrangeCard
            >
          }
          pull={shape === "phone" ? { width: 1, height: 1 } : layout.spread}
          picked={picked}
          onPick={setPicked}
          set={(card, patch) =>
            layouts[shape].setValues({ cards: { [card]: patch } } as never)
          }
          onClose={() => setView3d(false)}
        />
      ) : null}
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
      sweep
      className={className}
      style={{
        ...style,
        fontSize: `calc(clamp(44px, 10vw, ${n.size}px) * var(--m-name, 1))`,
      }}
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
        card.style.setProperty(
          "--mid-x",
          `${cover.left + cover.width / 2 - (f.left + f.width / 2)}px`,
        );
        card.style.setProperty(
          "--mid-y",
          `${cover.top + cover.height / 2 - (f.top + f.height / 2)}px`,
        );
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
        // Doubled: the card is drawn at half its size (`--os`, globals.css).
        boxShadow: `0 0 ${hover ? cards.shadow.blur * 2 : 0}px rgb(0 0 0 / ${cards.shadow.opacity})`,
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
