"use client";

import * as React from "react";
import { Liquid } from "@/components/liquid";
import { useDevice } from "@/lib/device";

/* Julian: the buttons in liquid (`liquid-gooey`). The first button is a
   body of the ink; the quiet ones beside it stay an outline at rest, and
   under a pointer (or a key) the ink runs out of the first one across the
   gap and fills them, necking between the two as it goes, and drains back
   when the pointer leaves. It takes the place of the quiet button's circle
   flood; the first button's own hover is as it was.

   The goo is one colour for the group, which is why the quiet ones are a
   drop that arrives rather than a body at rest: two solid buttons would
   read as the same button twice. The contact form's own button is not one
   of these (Julian). */
export function LiquidPair({
  className,
  fill = "var(--foreground)",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  /** The ink of the buttons: `--hero-ink` over the homepage's photographs. */
  fill?: string;
}) {
  /* Only under a mouse. The ink runs on a pointer's hover, which a finger
     never makes, and the liquid measured every button every frame to
     follow it: scrolling a phone, that was a forced layout a frame, about
     a second of the main thread in a short scroll (Julian: the motion
     seamless on iPhone and iPad). A finger gets the plain buttons, the
     same at rest. Plain on the server too, so the markup agrees. */
  const mouse = useDevice("fine");
  // When the pointer last left the first button (`Quiet` reads it).
  const left = React.useRef(-Infinity);
  /* And only while it is on screen, from the first idle moment after it
     arrives. Each liquid runs a loop of its own that wakes on any scroll
     on the page and measures its buttons every frame, and the homepage
     has five: on the way back from the portfolio they were set up inside
     the page swap and then measured every frame of the strip's travel,
     the largest cost of both crossings (scroll-craft pass, 2026-10-02).
     The plain buttons are the same at rest, so the change is not seen. */
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const [live, setLive] = React.useState(false);
  React.useEffect(() => {
    if (!mouse || !node) return;
    let soon = 0;
    const io = new IntersectionObserver(([e]) => {
      cancelIdle(soon);
      if (e.isIntersecting) soon = whenIdle(() => setLive(true));
      else setLive(false);
    });
    io.observe(node);
    return () => {
      io.disconnect();
      cancelIdle(soon);
    };
  }, [mouse, node]);
  if (!mouse || !live) {
    return (
      <div ref={setNode} {...rest} className={className}>
        {children}
      </div>
    );
  }
  /* Quiet by its class, not its place: on Sessions the first button is
     only there when there is a booking link. */
  const quiet = (child: React.ReactNode) =>
    React.isValidElement<{ className?: string }>(child) &&
    /-quiet/.test(child.props.className ?? "");
  return (
    <Liquid
      ref={setNode}
      blur={7}
      contrast={18}
      fill={fill}
      {...rest}
      className={`liquid-pair ${className ?? ""}`}
    >
      {React.Children.toArray(children).map((child, i) =>
        quiet(child) ? (
          <Quiet key={i} from={left}>
            {child}
          </Quiet>
        ) : (
          <span
            key={i}
            className="contents"
            onPointerLeave={() => (left.current = performance.now())}
          >
            <Liquid.Item observe>{child}</Liquid.Item>
          </span>
        ),
      )}
    </Liquid>
  );
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  cancelIdleCallback?: (h: number) => void;
};
// Safari has no idle callback; a beat stands in for it.
const whenIdle = (fn: () => void) => {
  const w = window as IdleWindow;
  return w.requestIdleCallback ? w.requestIdleCallback(fn, { timeout: 1000 }) : window.setTimeout(fn, 250);
};
const cancelIdle = (h: number) => {
  const w = window as IdleWindow;
  if (w.cancelIdleCallback) w.cancelIdleCallback(h);
  else window.clearTimeout(h);
};

/* Julian: the ink runs across only when the pointer goes straight from
   the first button to this one, crossing the gap within this long (ms).
   Come to it from anywhere else and it floods as the first one does, a
   circle out of where the pointer came in (`::before`, `globals.css`). */
const CROSS = 350;

function Quiet({
  children,
  from,
}: {
  children: React.ReactNode;
  from: React.RefObject<number>;
}) {
  const [on, setOn] = React.useState(false);
  /* Been on: drains back on the way out, and the glass waits for it (not
     on the first paint either). */
  const [was, setWas] = React.useState(false);
  const enter = () => {
    setOn(true);
    setWas(true);
  };
  return (
    <span
      className="relative inline-flex"
      onPointerEnter={(e) =>
        e.pointerType === "mouse" && performance.now() - from.current < CROSS && enter()
      }
      onPointerLeave={() => setOn(false)}
      onFocus={(e) => e.target.matches(":focus-visible") && enter()}
      onBlur={() => setOn(false)}
      data-on={on ? "" : undefined}
      data-was={!on && was ? "" : undefined}
      onAnimationEnd={(e) => {
        if (e.animationName === "liquid-drain") setWas(false);
      }}
    >
      {/* The drop (`.liquid-drop`, `globals.css`): at rest a sliver too
          thin to draw; on, it leaves the first button across the gap and
          runs the width of this one; off, it drains back. */}
      <Liquid.Item effect="move">
        <span aria-hidden className="liquid-drop" />
      </Liquid.Item>
      {children}
    </span>
  );
}
