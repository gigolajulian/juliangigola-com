"use client";

import * as React from "react";
import { Liquid } from "liquid-gooey";

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
  /* Quiet by its class, not its place: on Sessions the first button is
     only there when there is a booking link. */
  const quiet = (child: React.ReactNode) =>
    React.isValidElement<{ className?: string }>(child) &&
    /-quiet/.test(child.props.className ?? "");
  return (
    <Liquid
      blur={7}
      contrast={18}
      fill={fill}
      {...rest}
      className={`liquid-pair ${className ?? ""}`}
    >
      {React.Children.toArray(children).map((child, i) =>
        quiet(child) ? (
          <Quiet key={i}>{child}</Quiet>
        ) : (
          <Liquid.Item key={i} observe>
            {child}
          </Liquid.Item>
        ),
      )}
    </Liquid>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
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
      onPointerEnter={(e) => e.pointerType === "mouse" && enter()}
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
