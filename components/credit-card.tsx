"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Liquid } from "@/components/liquid";

/* ── who that is ──────────────────────────────────────────────────
 * A credit on a project page is a person's name and a link that takes the
 * visitor off the site. Held for a beat it says who they are first: their
 * face, their handle set large, and the way out under it.
 *
 * Julian (2026-10-02, overdrive, "Liquid"): the card is poured out of the
 * name. A drop of ink wells up under the word, which turns to the ground's
 * colour inside it, and the card is drawn up out of that drop, necking and
 * letting go as it rises, the way the filter bar's liquid moves. On the way
 * out it falls back into the word and the drop drains. The ink is the
 * Sessions ink, the foreground itself, opaque (the goo thresholds alpha).
 *
 * The liquid (`liquid-gooey`) exists only while a card is open, in a box
 * just large enough for the word and the card: a group that is not mounted
 * measures nothing, so the credits cost no frames while scrolling, which is
 * what the audit held against the always-on ones (2026-10-02).
 *
 * The photograph is ours, kept in `public/people` and written by /admin
 * when the person was added. Instagram is asked nothing at all from here:
 * its own picture addresses are signed and expire within days, so a page
 * that linked one would be printing broken circles a week later, and a
 * page that fetched one would be sending every visitor who happens to
 * hover a name to Instagram's servers. With no picture on file the circle
 * is simply not there and the handle carries the card.
 *
 * The card is the pointer's and the keyboard's, never a reader's: the name
 * it comes out of is the same link with the same words, so the card is
 * hidden from assistive technology and its own link is out of the tab
 * order. A phone never sees it (`HOVERS`).
 * ─────────────────────────────────────────────────────────────── */
const HOVERS = "(hover: hover) and (pointer: fine)";
const subscribeHover = (onChange: () => void) => {
  const mq = window.matchMedia(HOVERS);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/* The beat a name is held for before it pours, and the grace a pointer has
   to cross the gap from the word into the card. */
const OPEN_DELAY = 200;
const CLOSE_DELAY = 140;
/* The card, the room between it and the word, and the slack round the
   liquid's box for the goo to spread into. */
const W = 272;
const GAP = 14;
const SLACK = 40;

/* A spring as a `linear()` easing: settles with one small overshoot, the
   wobble 0.25 Julian set on the filter bar's liquid. */
const SPRING = (() => {
  const pts: string[] = [];
  const w = 2 * Math.PI * 1.35, z = 0.62;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const v = 1 - Math.exp(-z * w * t) * Math.cos(w * Math.sqrt(1 - z * z) * t);
    pts.push((i === 40 ? 1 : v).toFixed(4));
  }
  return `linear(${pts.join(", ")})`;
})();
const IN = "cubic-bezier(0.23, 1, 0.32, 1)";
const FALL = "cubic-bezier(0.55, 0, 0.75, 0.2)";

type Box = { left: number; top: number; width: number; height: number };
const inset = (b: Box, n: number): Box => ({ left: b.left + n, top: b.top + n, width: b.width - 2 * n, height: b.height - 2 * n });

export function CreditCard({
  handle,
  name,
  role,
  avatar,
  children,
}: {
  handle: string;
  name: string;
  role: string;
  /** A path under `public/`, or nothing. See `avatarFor` in `lib/work.ts`. */
  avatar?: string;
  /** The credit's own link, untouched but for the hover it now carries. */
  children: React.ReactElement<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;
}) {
  const hovers = React.useSyncExternalStore(
    subscribeHover,
    () => window.matchMedia(HOVERS).matches,
    // The server draws the plain link; a phone keeps it.
    () => false,
  );
  const word = React.useRef<HTMLElement | null>(null);
  // Where the word was when it was held, and whether the card is wanted.
  const [at, setAt] = React.useState<DOMRect | null>(null);
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef(0);

  const show = React.useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!word.current) return;
      setAt(word.current.getBoundingClientRect());
      setOpen(true);
    }, OPEN_DELAY);
  }, []);
  const hide = React.useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, []);
  const stay = React.useCallback(() => window.clearTimeout(timer.current), []);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  /* The credits sit inside a strip that can be dragged, and a card left
     hanging over a moving sequence has lost its anchor: any scroll, a
     resize or Escape shuts it at once. */
  React.useEffect(() => {
    if (!open) return;
    const shut = () => {
      window.clearTimeout(timer.current);
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && shut();
    window.addEventListener("scroll", shut, { capture: true, passive: true });
    window.addEventListener("resize", shut);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("scroll", shut, { capture: true });
      window.removeEventListener("resize", shut);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  if (!hovers) return children;

  const link = React.cloneElement(children, {
    ref: (el: HTMLElement | null) => {
      word.current = el;
    },
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => e.pointerType === "mouse" && show(),
    onPointerLeave: hide,
    onFocus: (e: React.FocusEvent<HTMLElement>) => e.currentTarget.matches(":focus-visible") && show(),
    onBlur: hide,
  });

  /* Six of the harvested credits are the handle and nothing else, so the
     card would have printed "@anisajadee" twice. The line under the handle
     is only for a person who has a name of their own on file. */
  const named = name.replace(/^@/, "").toLowerCase() !== handle.toLowerCase();

  return (
    <>
      {link}
      {at
        ? createPortal(
            <Pour
              at={at}
              open={open}
              source={word}
              onEnter={stay}
              onLeave={hide}
              onGone={() => setAt(null)}
            >
              <div className="flex items-start gap-3">
                {avatar ? (
                  /* A plain `img`: 100px of JPEG already the size it is
                     drawn at, and the box holds its place either way. */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt=""
                    width={56}
                    height={56}
                    draggable={false}
                    className="size-14 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p
                    /* A long handle is set smaller until it fits, rather
                       than cut: Julian saw @LIGHTBENDER_... Never below
                       three quarters of the size, past which the ellipsis
                       takes over again. */
                    ref={(el) => {
                      if (!el) return;
                      el.style.fontSize = "";
                      const fit = el.clientWidth / (el.scrollWidth + 2);
                      if (el.scrollWidth >= el.clientWidth) {
                        el.style.fontSize = `${Math.max(0.75, 1.25 * fit)}rem`;
                      }
                    }}
                    className="font-display truncate text-xl uppercase leading-none tracking-[0]"
                  >
                    @{handle}
                  </p>
                  <p className="label mt-1.5 truncate text-background/70">
                    {named ? name : ""}
                    {named && role ? " · " : ""}
                    {role}
                  </p>
                  {/* Where a pointer that has travelled into the card
                      arrives: the way out, pressable (Julian found the
                      words alone could not be). */}
                  <a
                    href={`https://www.instagram.com/${handle}/`}
                    target="_blank"
                    rel="noreferrer"
                    tabIndex={-1}
                    data-ring="Instagram"
                    className="label mt-3 inline-block text-background/70 transition-colors duration-200 hoverable:hover:text-background"
                  >
                    Open on Instagram &#8599;
                  </a>
                </div>
              </div>
            </Pour>,
            document.body,
          )
        : null}
    </>
  );
}

/* The liquid itself: a drop under the word and the card drawn out of it.
   Both are boxes the liquid follows (`observe`), moved with the Web
   Animations API, so the goo necks between them for as long as they are
   close and lets go when they part. */
function Pour({
  at,
  open,
  source,
  onEnter,
  onLeave,
  onGone,
  children,
}: {
  at: DOMRect;
  open: boolean;
  source: React.RefObject<HTMLElement | null>;
  onEnter: () => void;
  onLeave: () => void;
  onGone: () => void;
  children: React.ReactNode;
}) {
  const card = React.useRef<HTMLDivElement>(null);
  const drop = React.useRef<HTMLDivElement>(null);
  const ink = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const copy = React.useRef<HTMLSpanElement>(null);
  const [height, setHeight] = React.useState(0);

  /* The drop: a rectangle just round the word's own line, inside the
     link's padded hit area, so it never reaches the credit under it
     (Julian: more of a rectangle, off the line below). */
  const dropBox: Box = {
    left: at.left - 6,
    top: at.top + 3,
    width: at.width + 12,
    height: at.height - 6,
  };
  /* The card: under the credit (Julian, 2026-10-02), over it only where
     the window has no room below, and kept off the window's edges. */
  const h = height || 1;
  const above = dropBox.top + dropBox.height + GAP + h > window.innerHeight - 16;
  const cardBox: Box = {
    left: Math.max(16, Math.min(dropBox.left, window.innerWidth - W - 16)),
    top: above ? dropBox.top - GAP - h : dropBox.top + dropBox.height + GAP,
    width: W,
    height: h,
  };
  // The liquid's own box: both, with room for the goo.
  const x0 = Math.min(dropBox.left, cardBox.left) - SLACK;
  const y0 = Math.min(dropBox.top, cardBox.top) - SLACK;
  const x1 = Math.max(dropBox.left + dropBox.width, cardBox.left + W) + SLACK;
  const y1 = Math.max(dropBox.top + dropBox.height, cardBox.top + h) + SLACK;
  const local = (b: Box) => ({
    left: `${b.left - x0}px`,
    top: `${b.top - y0}px`,
    width: `${b.width}px`,
    height: `${b.height}px`,
  });

  // The card's height, from its content at its width, before anything moves.
  React.useLayoutEffect(() => {
    if (inner.current) setHeight(Math.ceil(inner.current.scrollHeight));
  }, []);

  /* The word inside the drop is the word itself, in the ground's colour:
     the same face, size and tracking, read off the link. */
  React.useLayoutEffect(() => {
    const src = source.current;
    if (!src || !copy.current) return;
    const s = getComputedStyle(src);
    Object.assign(copy.current.style, {
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      letterSpacing: s.letterSpacing,
      textTransform: s.textTransform,
      left: `${at.left - x0}px`,
      top: `${at.top - y0}px`,
      lineHeight: `${at.height}px`,
    });
    copy.current.textContent = src.innerText.split("\n")[0];
  });

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  React.useEffect(() => {
    if (!height || !card.current || !drop.current || !ink.current || !inner.current || !copy.current) return;
    const c = card.current, i = inner.current, w = copy.current;
    const both = (k: Keyframe[], o: KeyframeAnimationOptions) => [drop.current!, ink.current!].map((e) => e.animate(k, o));
    const from = local(dropBox), to = local(cardBox);
    const t = (ms: number) => (reduce ? 0 : ms);
    let anims: Animation[];
    if (open) {
      anims = [
        ...both([{ transform: "scale(0.3)" }, { transform: "scale(1)" }], {
          duration: t(260), easing: IN, fill: "both",
        }),
        w.animate([{ opacity: 0 }, { opacity: 1 }], { duration: t(160), delay: t(90), easing: IN, fill: "both" }),
        c.animate([from, to], { duration: t(560), delay: t(90), easing: SPRING, fill: "both" }),
        i.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
          duration: t(240), delay: t(reduce ? 0 : 360), easing: IN, fill: "both",
        }),
      ];
    } else {
      anims = [
        i.animate([{ opacity: 1 }, { opacity: 0 }], { duration: t(110), easing: "ease-out", fill: "both" }),
        c.animate([to, from], { duration: t(320), delay: t(60), easing: FALL, fill: "both" }),
        w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: t(140), delay: t(330), easing: "ease-out", fill: "both" }),
        ...both([{ transform: "scale(1)" }, { transform: "scale(0)" }], {
          duration: t(220), delay: t(340), easing: FALL, fill: "both",
        }),
      ];
      Promise.all(anims.map((a) => a.finished)).then(onGone, () => {});
    }
    return () => anims.forEach((a) => a.cancel());
    // Geometry is fixed for the life of one opening; `open` drives it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, height]);

  return (
    <div
      aria-hidden
      className="credit-pour pointer-events-none fixed z-50"
      style={{ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }}
    >
      <Liquid
        blur={7}
        contrast={18}
        fill="var(--foreground)"
        shadow="0 14px 34px rgb(0 0 0 / 0.28)"
        /* Its own style sets `position: relative`; the size is what its
           filter region is measured from, so it has to be the whole box. */
        className="h-full w-full"
      >
        {/* The drop's liquid, 3px inside the rectangle drawn over it: the
            goo's edge sits a little outside a shape this thin, and showed
            as a wavy rim round the word (Julian, live, 2026-10-02). It is
            there for the neck to the card. */}
        <Liquid.Item observe>
          <div
            ref={drop}
            className="absolute"
            style={{ ...local(inset(dropBox, 3)), transform: "scale(0)" }}
          />
        </Liquid.Item>
        <Liquid.Item observe radius={16}>
          <div
            ref={card}
            data-ring=""
            onPointerEnter={onEnter}
            onPointerLeave={onLeave}
            className="pointer-events-auto absolute overflow-hidden rounded-2xl"
            style={local(dropBox)}
          >
            <div ref={inner} className="w-[272px] p-4 text-background" style={{ opacity: 0 }}>
              {children}
            </div>
          </div>
        </Liquid.Item>
      </Liquid>
      {/* The drop itself, crisp, over its liquid. */}
      <div
        ref={ink}
        className="absolute rounded-[3px] bg-foreground"
        style={{ ...local(dropBox), transform: "scale(0)" }}
      />
      {/* Over the liquid, where the word is: the word again, in the ground. */}
      <span ref={copy} className="absolute whitespace-nowrap text-background" style={{ opacity: 0 }} />
    </div>
  );
}
