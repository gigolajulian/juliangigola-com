import type { Mover } from "./motion";
import { centreOf } from "./shared";

/** The keys that move the strip, and Tab kept from jumping it. */
export function keyHandlers(m: Mover) {
  const { el } = m;
  /* The keyboard, on the scroller or anything in it that does not want
     the keys for itself: the arrows and Page Up and Page Down move a
     screen, Home and End go to the ends. A paged strip's screen is its
     next cell; a free one moves by the window's width. A key pressed in
     a field, or in a box that scrolls on its own, is that one's. It
     listened on the scroller alone, so with a cover or a link inside it
     focused the arrows did nothing (2026-10-09). */
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const from = e.target as HTMLElement | null;
    if (!from || !el.contains(from)) return;
    if (
      from !== el &&
      from.closest(
        'input, textarea, select, [contenteditable="true"], [role="slider"], [role="radiogroup"], [role="radio"], [role="listbox"], [role="menu"], dialog[open]',
      )
    )
      return;
    const page = e.key === "PageDown" || e.key === "PageUp";
    // Page Up and Page Down scroll a box of words in their own way.
    if (page && from !== el && from.closest("[data-scroll]")) return;
    const step =
      e.key === "ArrowRight" || e.key === "PageDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "PageUp"
          ? -1
          : 0;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    // The strip may have grown since it was last measured (`defer`).
    m.size();
    const last = el.children.length - 1;
    let where: number | null;
    if (e.key === "Home") where = 0;
    // The end itself: the last cell is often narrower than half a
    // window, so its centre is short of the end.
    else if (e.key === "End") where = m.room();
    else if (m.paged) {
      /* Where the strip is going, not where it is: three quick presses
         should step three screens, and each one read the cell in the
         middle of the window while the glide from the press before it
         was still on its way there. */
      const i = Math.max(0, Math.min(last, m.nearest(m.target) + step));
      where = i === 0 ? 0 : i === last ? m.room() : centreOf(el, i);
    } else where = m.target + step * m.width;
    if (where === null) return;
    m.to(where);
    /* Focus does not stay behind on a screen that is leaving: it goes
       back to the strip, which says where it now is. */
    if (from !== el) el.focus({ preventScroll: true });
  };

  /* Tab into a section that is off screen and the browser jumps the box
     to it: instantly, and to wherever it takes to get the element in
     view, which on a paged page is usually between two sections. So the
     jump is put back and the strip travels there itself. Only for the
     keyboard - a press focuses what it presses, and recentring under a
     click would be the page moving for no reason. */
  let beforeTab = -1;
  const onTab = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    beforeTab = el.scrollLeft;
    window.setTimeout(() => {
      beforeTab = -1;
    }, 0);
  };
  const onFocusIn = (e: FocusEvent) => {
    const node = e.target as Node | null;
    if (beforeTab < 0 || !node || node === el || !el.contains(node)) return;
    const i = Array.from(el.children).findIndex((c) => c.contains(node));
    const where = i < 0 ? null : centreOf(el, i);
    if (where === null) return;
    el.scrollLeft = beforeTab;
    beforeTab = -1;
    if (Math.abs(where - el.scrollLeft) > 2) m.to(where);
  };

  return { onKey, onTab, onFocusIn };
}

/**
 * Keeps Tab on the cells in the window (below). `geo` is where the cells
 * are, as the strip last measured them: their centres and widths along
 * the strip, and the window's width.
 */
export function createBench(
  el: HTMLElement,
  tabbed: { current: boolean },
  geo: () => { centres: number[]; widths: number[]; span: number },
) {
  /* ── Tab stays on screen ──
     A cell wholly off the window is taken out of the Tab order, and
     whatever in it takes focus with it, so Tab never lands on a screen
     nobody can see; the arrows (`onKey`) are how the strip moves on.
     Its old `tabindex` is kept on `data-strip-tab` and put back the
     moment any of it comes into the window. Not `inert`: that would take
     the cells from a screen reader as well, and a click on a cover
     arriving under a fling. Set once the page has gone quiet, not in the
     arrival (`tabbing`). */
  const benched = new Set<number>();
  let tabbing = false;
  /* A box that scrolls on its own is a Tab stop in Chrome without a
     `tabindex` (the Legal page's contents), so those count too. */
  const TABBABLE =
    'a[href], button, input, select, textarea, iframe, summary, [tabindex], [data-scroll], [class*="overflow-y-auto"], [class*="overflow-auto"]';
  const bench = (cell: HTMLElement, out: boolean) => {
    const list = Array.from(cell.querySelectorAll<HTMLElement>(TABBABLE));
    if (cell.matches(TABBABLE)) list.unshift(cell);
    for (const f of list) {
      if (out) {
        const was = f.getAttribute("tabindex");
        if (was === "-1" || f.dataset.stripTab !== undefined) continue;
        f.dataset.stripTab = was ?? "";
        f.setAttribute("tabindex", "-1");
      } else if (f.dataset.stripTab !== undefined) {
        const was = f.dataset.stripTab;
        delete f.dataset.stripTab;
        if (was) f.setAttribute("tabindex", was);
        else f.removeAttribute("tabindex");
      }
    }
  };
  const benchAll = (x: number) => {
    if (!tabbing) return;
    const { centres, widths, span } = geo();
    const kids = el.children;
    for (let i = 0; i < kids.length; i++) {
      const half = (widths[i] ?? 0) / 2;
      const out = centres[i] + half <= x + 1 || centres[i] - half >= x + span - 1;
      if (out === benched.has(i)) continue;
      if (out) benched.add(i);
      else benched.delete(i);
      bench(kids[i] as HTMLElement, out);
    }
  };
  const unbenchAll = () => {
    for (const f of Array.from(el.querySelectorAll<HTMLElement>("[data-strip-tab]"))) {
      const was = f.dataset.stripTab;
      delete f.dataset.stripTab;
      if (was) f.setAttribute("tabindex", was);
      else f.removeAttribute("tabindex");
    }
    benched.clear();
  };
  let tabWait = 0;
  const startTabbing = () => {
    tabbing = true;
    tabbed.current = true;
    benchAll(el.scrollLeft);
  };
  /* A screen off the window can still fill in (the Inquiries screen
     grew from 7 controls to 127 while it was away), and what arrives
     is out of the Tab order with the rest of it, a frame on. */
  let rebench = 0;
  const filled = new MutationObserver(() => {
    if (rebench || !tabbing || !benched.size) return;
    rebench = requestAnimationFrame(() => {
      rebench = 0;
      for (const i of benched) {
        const c = el.children[i] as HTMLElement | undefined;
        if (c) bench(c, true);
      }
    });
  });
  filled.observe(el, { childList: true, subtree: true });
  /* Again at once when this runs again for cells that have arrived
     (`count`): only the page's arrival waits. */
  if (tabbed.current) startTabbing();
  else
    tabWait =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(startTabbing, { timeout: 1500 })
        : window.setTimeout(startTabbing, 800);

  const stop = () => {
    if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(tabWait);
    window.clearTimeout(tabWait);
    filled.disconnect();
    cancelAnimationFrame(rebench);
    unbenchAll();
  };
  return { benchAll, stop };
}
