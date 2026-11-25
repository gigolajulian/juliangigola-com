"use client";

import { useEffect, useRef } from "react";
import { loadGsap } from "@/lib/motion/gsap-lazy";
import "./tilted-card.css";

/* From React Bits' TiltedCard, cut to what the lightbox uses: its children
   tilt to the pointer and grow a little while it is on them. The springs
   (stiffness 100, damping 30, mass 2) are gsap tweens now: power2.out over
   1.2 s passes half way and 99% about when that spring did. Reduce Motion
   holds the card still in CSS (`motion-plan.css`). */
const EASE = { duration: 1.2, ease: "power2.out" } as const;

type Tilt = { rx: number; ry: number; s: number };
type To = (v: number) => void;

export default function TiltedCard({
  containerHeight = "300px",
  containerWidth = "100%",
  imageHeight = "300px",
  imageWidth = "300px",
  scaleOnHover = 1.1,
  rotateAmplitude = 14,
  children,
}: {
  containerHeight?: string;
  containerWidth?: string;
  imageHeight?: string;
  imageWidth?: string;
  scaleOnHover?: number;
  rotateAmplitude?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const now = useRef<Tilt>({ rx: 0, ry: 0, s: 1 });
  const goal = useRef<Tilt>({ rx: 0, ry: 0, s: 1 });
  const to = useRef<Record<keyof Tilt, To>>(null);

  // The same transform string the spring wrote: scale first, then the turns.
  const paint = () => {
    const el = inner.current;
    if (!el) return;
    const { rx, ry, s } = now.current;
    const parts = [s !== 1 && `scale(${s})`, rx && `rotateX(${rx}deg)`, ry && `rotateY(${ry}deg)`].filter(Boolean);
    el.style.transform = parts.length ? parts.join(" ") : "none";
  };

  const aim = (next: Partial<Tilt>) => {
    Object.assign(goal.current, next);
    if (to.current) {
      for (const k of Object.keys(next) as (keyof Tilt)[]) to.current[k](goal.current[k]);
      return;
    }
    // gsap arrives on the first hover; until then the card waits, then
    // heads for wherever the pointer is by then.
    void loadGsap().then((g) => {
      if (to.current || !inner.current) return;
      const make = (k: keyof Tilt) => g.quickTo(now.current, k, { ...EASE, onUpdate: paint });
      to.current = { rx: make("rx"), ry: make("ry"), s: make("s") };
      for (const k of ["rx", "ry", "s"] as const) to.current[k](goal.current[k]);
    });
  };

  useEffect(() => {
    const target = now.current;
    return () => {
      if (to.current) void loadGsap().then((g) => g.killTweensOf(target));
    };
  }, []);

  function handleMouse(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    aim({
      rx: (offsetY / (rect.height / 2)) * -rotateAmplitude,
      ry: (offsetX / (rect.width / 2)) * rotateAmplitude,
    });
  }

  return (
    <figure
      ref={ref}
      className="tilted-card-figure"
      style={{ height: containerHeight, width: containerWidth }}
      onMouseMove={handleMouse}
      onMouseEnter={() => aim({ s: scaleOnHover })}
      onMouseLeave={() => aim({ s: 1, rx: 0, ry: 0 })}
    >
      <div ref={inner} className="tilted-card-inner" style={{ width: imageWidth, height: imageHeight }}>
        {children}
      </div>
    </figure>
  );
}
