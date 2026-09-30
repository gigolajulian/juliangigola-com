"use client";

import * as React from "react";

/* ── the middle on a phone, to the wordmark's width ───────────────
 * Julian: on a phone the lines under the name should be tightened, and
 * as wide as the wordmark, the role and the location one line each. Each
 * line (`.fit-line`) is spread with letter spacing until it starts and ends
 * under the name's edges; one too long for that at its own size comes
 * down in size instead, so nothing is squeezed. The name is drawn on a
 * canvas wider than its words, so its width is measured off the words
 * themselves, set in the same face at the same size. Phones held upright
 * only; everywhere else the lines run on as one.
 * ─────────────────────────────────────────────────────────────── */

const PHONE = "(max-width: 39.99rem) and (orientation: portrait)";

export function FitLines() {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const middle = ref.current?.closest<HTMLElement>(".cover-float-middle");
    const name = middle?.querySelector<HTMLElement>(".cover-float-name");
    if (!middle || !name) return;
    const phone = matchMedia(PHONE);
    const lines = () => [...middle.querySelectorAll<HTMLElement>(".fit-line")];
    const clear = () =>
      lines().forEach((l) => {
        l.style.letterSpacing = "";
        l.style.fontSize = "";
        l.style.paddingLeft = "";
      });

    /* Writes, then one read, then writes: measuring line by line forced a
       layout of the whole cover per line, several times a load (mount, the
       fonts, the name's first size), ~190ms on a throttled phone. */
    const fit = () => {
      if (!phone.matches) return clear();
      const size = getComputedStyle(name).fontSize;
      /* The words of the name, unseen, in its face and size. */
      const probe = document.createElement("span");
      probe.textContent = "Julian Gigola";
      probe.style.cssText =
        `position:absolute;visibility:hidden;white-space:nowrap;font-family:var(--font-display);font-weight:900;` +
        `letter-spacing:-0.045em;font-size:${size}`;
      middle.appendChild(probe);
      const all = lines();
      all.forEach((l) => {
        l.style.letterSpacing = "0";
        l.style.fontSize = "";
        l.style.paddingLeft = "";
      });
      /* No wider than the name as drawn: its canvas fits itself to the
         screen, and the words set at full size ran 421px on a 390px
         phone, both lines off both edges. */
      const target = Math.min(
        probe.getBoundingClientRect().width,
        name.getBoundingClientRect().width,
      );
      const read = all.map((l) => ({
        w: l.getBoundingClientRect().width,
        n: [...(l.textContent ?? "")].length,
        size: parseFloat(getComputedStyle(l).fontSize),
      }));
      probe.remove();
      all.forEach((l, i) => {
        const { w, n, size } = read[i];
        if (!w || n < 2) return;
        if (w > target) {
          // Too long at its size: smaller, not squeezed.
          l.style.fontSize = `${size * (target / w)}px`;
        } else {
          const ls = (target - w) / (n - 1);
          l.style.letterSpacing = `${ls}px`;
          // The spacing after the last letter matched before the first,
          // so the words sit on the name's centre.
          l.style.paddingLeft = `${ls}px`;
        }
      });
    };
    // Once a frame, however many of the triggers below arrive in it.
    let frame = 0;
    const soon = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    fit();
    void document.fonts.ready.then(soon);
    const sizes = new ResizeObserver(soon);
    sizes.observe(name);
    phone.addEventListener("change", soon);
    // The arrange tool sizing the lines (`hero-dials.tsx`).
    window.addEventListener("jg-fit", soon);
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      phone.removeEventListener("change", soon);
      window.removeEventListener("jg-fit", soon);
      clear();
    };
  }, []);

  return <span ref={ref} hidden />;
}
