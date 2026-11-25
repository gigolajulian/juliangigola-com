"use client";

import * as React from "react";
import { v4pages } from "@/lib/flags/v4pages";
import { matches } from "@/lib/device";
import type { FrameView } from "@/components/portfolio/work";
import type { FrameItem } from "@/components/portfolio/frame-view";

/* The project page's two pieces of the inner-pages plan, kept out
   of the server component. Renders nothing until a frame is opened.
   next (j2): the Next link is a full stage; this feeds its wipe (`--in`, the
     engine's meaning: 0 as its top reaches the bottom of the screen, 1 at the top).
   view (j3): a click on a frame opens it full size in the gallery's FrameView. Still on trial (`?v4pages`). */
const FIGS = ".pj-big, .pj-lead .pj-r, .pj-flow .pj-r"; // document order = the order of `frames`

export function ProjectViewer({ frames }: { frames: FrameItem[] }) {
  const [at, setAt] = React.useState<number | null>(null);
  // work.tsx is loaded on the first open, so the project page does not carry the gallery
  const [View, setView] = React.useState<typeof FrameView | null>(null);
  const close = React.useCallback(() => setAt(null), []);

  React.useEffect(() => {
    const st = document.querySelector<HTMLElement>("#p-project .pj-next");
    if (!st || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const desk = matches("held");
    let raf = 0;
    const set = () =>
      st.style.setProperty("--in", Math.min(1, Math.max(0, (innerHeight - st.getBoundingClientRect().top) / innerHeight)).toFixed(3));
    const tick = () => {
      raf = requestAnimationFrame(tick);
      set();
    };
    if (desk) {
      // closed before it is on screen, and the loop starts half a screen early: no frame of the open stage as it enters
      set();
      const io = new IntersectionObserver(
        ([e]) => {
          cancelAnimationFrame(raf);
          if (e.isIntersecting) raf = requestAnimationFrame(tick);
        },
        { rootMargin: "50% 0px" },
      );
      io.observe(st);
      return () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        st.style.removeProperty("--in");
      };
    }
    /* Phones and tablets: natural scroll, the stage opens once as it comes into view. A scroll check, not an
       IntersectionObserver: the closed stage is clipped to nothing, and Chrome then reports it as never in view. */
    st.dataset.rv = "";
    const see = () => {
      if (st.getBoundingClientRect().top > innerHeight * 0.85) return;
      st.dataset.rv = "in";
      removeEventListener("scroll", see);
    };
    addEventListener("scroll", see, { passive: true });
    see();
    return () => {
      removeEventListener("scroll", see);
      delete st.dataset.rv;
    };
  }, []);

  const n = frames.length;
  React.useEffect(() => {
    const root = document.getElementById("p-project");
    if (!root || !n || !v4pages("view")) return;
    const figs = [...root.querySelectorAll<HTMLElement>(FIGS)];
    figs.forEach((f, i) => {
      f.tabIndex = 0;
      f.setAttribute("role", "button");
      f.setAttribute("aria-label", `Open frame ${i + 1} of ${n}`);
    });
    const open = (e: Event) => {
      const t = e.target as Element;
      if (t.closest("a")) return; // the client's logo on the opening frame is a link
      const i = figs.indexOf(t.closest<HTMLElement>(".pj-big, .pj-r")!);
      if (i < 0 || i >= n) return;
      if (e instanceof KeyboardEvent) {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
      }
      void import("@/components/portfolio/work").then((m) => {
        setView(() => m.FrameView);
        setAt(i);
      });
    };
    root.addEventListener("click", open);
    root.addEventListener("keydown", open);
    return () => {
      root.removeEventListener("click", open);
      root.removeEventListener("keydown", open);
      figs.forEach((f) => (f.removeAttribute("tabindex"), f.removeAttribute("role"), f.removeAttribute("aria-label")));
    };
  }, [n]);

  return View ? <View list={frames} at={at} onGo={setAt} onClose={close} /> : null;
}
