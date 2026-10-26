"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

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
        ".v3 .a-seq figure, .v3 .sheet figure, .v3 .door, .v3 .wgrid .wt, .v3 .a-index .frame, .v3 .wstrip .sc, .v3 .sc-res .wt"
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
