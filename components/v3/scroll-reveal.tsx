"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { mplan } from "@/lib/mplan";

export function ScrollReveal() {
  const pathname = usePathname();

  React.useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.inView = "true";
          }
        }
      },
      {
        threshold: 0.05,
        rootMargin: "50px 0px 50px 0px",
      }
    );

    const observeTargets = () => {
      const targets = document.querySelectorAll(
        ".v3 .a-seq figure, .v3 .sheet figure, .v3 .door, .v3 .wgrid .wt, .v3 .a-index .frame, .v3 .wstrip .sc, .v3 .sc-res .wt" +
          // MOTION-PLAN.md item 7 (`?mplan=reveal`): project figures reveal once on entry.
          (mplan("reveal") ? ", .v3 .pj-r" : "")
      );
      targets.forEach((el) => observer.observe(el));
    };

    // Initial check after paint
    const raf = requestAnimationFrame(observeTargets);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
