/* ── the name that becomes the heading ────────────────────────────
 * The name pressed in the menu, or in the bar on a desktop, should
 * travel into the heading of the screen it opens.
 *
 * Two copies of the word fly together: one in the link's own type, one in
 * the heading's, swapping halfway so the small mono label on a desktop is
 * the heading by the time it lands. On a phone both are the display face
 * and the swap is invisible. The flight aims at where the heading is on
 * each frame, so a strip still gliding to its screen is caught rather
 * than waited for, and the heading itself is held out of sight until the
 * word lands on it.
 *
 * Preview only while Julian decides: `?fly=1` turns it on for the visit,
 * `?fly=0` off.
 * ─────────────────────────────────────────────────────────────── */

const MS = 700;
const ease = (t: number) => 1 - Math.pow(1 - t, 4);

function textBox(el: Element) {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getBoundingClientRect();
}

function heading(label: string) {
  if (label === "Portfolio") return document.querySelector<HTMLElement>(".chapter-alias");
  return document.querySelector<HTMLElement>(
    `[data-label="${label}"] :is(h1, h2):has(.title-word)`,
  );
}

function copy(of: HTMLElement, text: string) {
  const s = getComputedStyle(of);
  const el = document.createElement("div");
  el.textContent = text;
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed",
    left: "0",
    top: "0",
    margin: "0",
    zIndex: "60",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    transformOrigin: "0 0",
    fontFamily: s.fontFamily,
    fontWeight: s.fontWeight,
    fontSize: s.fontSize,
    letterSpacing: s.letterSpacing,
    lineHeight: s.lineHeight,
    textTransform: s.textTransform,
    color: s.color,
  });
  document.body.append(el);
  return el;
}

function fly(link: HTMLAnchorElement) {
  const label = link.textContent?.trim() ?? "";
  const from = textBox(link);
  const small = copy(link, label);
  let big: HTMLElement | null = null;
  let bigW = 1;
  let target: HTMLElement | null = null;
  const start = performance.now();
  let t0 = 0;
  let steady = 0;
  let last = "";

  const place = (el: HTMLElement, box: DOMRect, own: DOMRect) => {
    const k = box.width / own.width;
    el.style.transform = `translate(${box.left}px, ${box.top}px) scale(${k})`;
  };
  const smallOwn = from;

  const done = () => {
    target?.removeAttribute("data-fly-hold");
    small.remove();
    if (big) {
      big.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 }).finished.then(() => big?.remove());
    }
  };

  const frame = (now: number) => {
    if (!target) {
      target = heading(label);
      if (target) {
        target.setAttribute("data-fly-hold", "");
        target.setAttribute("data-flown", "");
        big = copy(target, (target.textContent ?? "").trim());
        bigW = big.getBoundingClientRect().width || 1;
        big.style.opacity = "0";
      }
    }
    const to = target ? textBox(target) : null;
    /* The word waits where it was pressed, at full strength, while the
       drawer shuts and the page travels under it, and sets off once the
       heading is on the screen: chased from off the screen, it flew out
       of the window and back (a phone, where the screens are a long
       scroll apart). */
    if (!t0) {
      const seen =
        to && to.top >= 0 && to.bottom <= innerHeight && to.left >= 0 && to.right <= innerWidth;
      if (seen || (to && now - start > 1500)) t0 = now;
      else if (now - start > 1600) {
        // Nothing to land on: the word fades where it stood.
        small.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.then(() => small.remove());
        target?.removeAttribute("data-fly-hold");
        return;
      } else {
        place(small, from, smallOwn);
        return requestAnimationFrame(frame);
      }
    }
    if (!to || !big) return;
    const t = Math.min(1, (now - t0) / MS);
    const e = ease(t);
    const box = new DOMRect(
      from.left + (to.left - from.left) * e,
      from.top + (to.top - from.top) * e,
      from.width + (to.width - from.width) * e,
      from.height + (to.height - from.height) * e,
    );
    place(small, box, smallOwn);
    place(big, box, new DOMRect(0, 0, bigW, 0));
    const swap = Math.min(1, Math.max(0, (e - 0.25) / 0.5));
    small.style.opacity = String(1 - swap);
    big.style.opacity = String(swap);
    const key = `${Math.round(to.left)},${Math.round(to.top)}`;
    steady = key === last ? steady + 1 : 0;
    last = key;
    if (t < 1 || (steady < 3 && now - t0 < MS + 1500)) return requestAnimationFrame(frame);
    done();
  };
  requestAnimationFrame(frame);
}

export function installNavFly() {
  try {
    const q = new URLSearchParams(location.search).get("fly");
    if (q === "1") sessionStorage.setItem("jg-fly", "1");
    if (q === "0") sessionStorage.removeItem("jg-fly");
    if (sessionStorage.getItem("jg-fly") !== "1") return () => {};
  } catch {
    return () => {};
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const onClick = (e: MouseEvent) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.<HTMLAnchorElement>(
      '.site-menu a, nav[aria-label="Main"] a',
    );
    if (!a) return;
    document.querySelectorAll("[data-flown]").forEach((el) => el.removeAttribute("data-flown"));
    fly(a);
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
