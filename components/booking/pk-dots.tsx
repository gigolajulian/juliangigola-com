"use client";

import * as React from "react";

/** Under the phone's swipe row of package cards: one square per card, the one in view lit. Hidden on desktop (v3.css). */
export function PkDots({ count }: { count: number }) {
  const box = React.useRef<HTMLOListElement>(null);
  const [at, setAt] = React.useState(0);
  React.useEffect(() => {
    const row = box.current?.previousElementSibling as HTMLElement | null;
    if (!row) return;
    const read = () => {
      const c = row.children as HTMLCollectionOf<HTMLElement>;
      const step = c.length > 1 ? c[1].offsetLeft - c[0].offsetLeft : 1;
      // the last card never reaches the snap line, so the row's end lights it
      const end = row.scrollLeft >= row.scrollWidth - row.clientWidth - 2;
      setAt(end ? c.length - 1 : Math.round(row.scrollLeft / step));
    };
    row.addEventListener("scroll", read, { passive: true });
    return () => row.removeEventListener("scroll", read);
  }, []);
  return (
    <ol ref={box} className="pk-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={i === at ? "on" : undefined} />
      ))}
    </ol>
  );
}
