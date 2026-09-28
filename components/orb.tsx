"use client";

import * as React from "react";
import { ThinkingOrb } from "thinking-orbs";

/**
 * Julian: the thinking orbs (`thinking-orbs`) where the site makes someone
 * wait. The package picks its ink from the page's theme, which is wrong on
 * a filled button, where the text is the page's ground. So the orb takes
 * the colour of the text around it instead, and the light or dark ramp
 * from how light that colour is. Read through a one-pixel canvas, which
 * turns whatever the stylesheet wrote (a `color-mix`, an `oklch`) into
 * plain RGB, and again whenever the theme changes. Hidden from screen
 * readers: the words beside it say what is happening.
 */
export function Orb(props: React.ComponentProps<typeof ThinkingOrb>) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [ink, setInk] = React.useState<{
    color: string;
    theme: "dark" | "light";
  } | null>(null);

  React.useEffect(() => {
    const pixel = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    });
    const read = () => {
      const el = ref.current;
      if (!el || !pixel) return;
      pixel.clearRect(0, 0, 1, 1);
      pixel.fillStyle = getComputedStyle(el).color;
      pixel.fillRect(0, 0, 1, 1);
      const [r, g, b] = pixel.getImageData(0, 0, 1, 1).data;
      const light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
      setInk({ color: `rgb(${r}, ${g}, ${b})`, theme: light ? "dark" : "light" });
    };
    const first = requestAnimationFrame(read);
    const theme = new MutationObserver(read);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", read);
    return () => {
      cancelAnimationFrame(first);
      theme.disconnect();
      scheme.removeEventListener("change", read);
    };
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden
      className="inline-flex shrink-0"
      style={{ width: props.size ?? 64, height: props.size ?? 64 }}
    >
      {ink ? <ThinkingOrb {...props} color={ink.color} theme={ink.theme} /> : null}
    </span>
  );
}
