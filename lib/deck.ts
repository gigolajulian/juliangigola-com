/* ── the deck ─────────────────────────────────────────────────────
 * React Bits' ScrollStack, turned on its side for a site that moves
 * sideways. Julian: integrate it, but make it make sense.
 *
 * ScrollStack pins each card at the top of a vertical scroll and lets the
 * next one ride up over it, the ones underneath shrinking back. Here the
 * strip scrolls left and right, so a card pins at the left edge and the
 * next slides in over it from the right, like prints dealt onto a table.
 * The pinning is `position: sticky`, which a native horizontal scroller
 * does on the compositor for nothing and without a frame of lag; this
 * script only adds the depth as the next card covers it.
 *
 * Three ways to deal:
 *
 *   "pile"      only the children marked `data-deck`, each pinned a
 *               little right of the last, so the pile shows an edge of
 *               every card in it (ScrollStack's `itemStackDistance`). A
 *               covered card sinks back toward its pinned edge. Sessions.
 *   "screens"   every child, all pinned at the edge: each card lands
 *               over the one before, which recedes into the space behind
 *               it, about its middle, the way ScrollStack's cards do. The
 *               homepage and About, a screen a card; a discipline's page
 *               and a project's page, a cover or a frame a card, since
 *               Julian wants the stack wherever he is in the work.
 *   "chapters"  a strip far too long for screens, dealt at its chapter
 *               breaks: the children marked `data-deck` open the
 *               chapters. A chapter runs past as it always did, and when
 *               its last screen fills the window that screen holds while
 *               the next chapter slides in over it and it recedes, as a
 *               screen does. The work index. Julian, after a version that
 *               pinned the chapter titles: not the sticky thing; when
 *               passing a filter the next one comes in as a card.
 *   "leads"     nothing within. The deal is at the ends, where the strip
 *               leads on to the next page and back to the one before:
 *               the next page's strip comes in as a card over this one,
 *               and this one recedes (`leave` in `strip.tsx`, `deal` in
 *               `globals.css`). A discipline's page and a project's page.
 *               Julian: not the photographs within a filter stacking on
 *               each other; the stack when scrolling into the next and
 *               the project before.
 *
 * Nothing fades and nothing casts a shadow: Julian wants cards in space
 * stacking over each other, every one whole. The recede is the depth.
 *
 * Chrome folds the sticky offset into a stuck cell's `offsetLeft`, so a
 * pinned cover reads as sitting exactly where the screen over it does,
 * and the strip's paging, which finds the nearest cell by `offsetLeft`,
 * chose the cover every time and never moved on. So every cell is
 * stamped with its layout position (`data-at`) before it is pinned, and
 * the strip reads that instead (`leftOf` in `strip.tsx`).
 *
 * Only `scale`, which the compositor runs without a repaint: a
 * `brightness()` filter on a whole screen repainted it every frame, and
 * that was the homepage's lag. And as a paused animation scrubbed by the
 * scroll rather than a style: a cover is a `.strip-cell`, which eases
 * `scale` on a bounce for the press, and a value written every frame
 * would ride that bounce a frame behind. Cancelled at nought, so the
 * press has the card back.
 *
 * Wide screens only, and not for anybody who asked for less motion. Under
 * 40rem a strip runs its cells down the page and there is no sideways to
 * deal along.
 * ─────────────────────────────────────────────────────────────── */

export type Deck = "pile" | "screens" | "chapters" | "leads";

const PEEK = 20; // px of each card left showing on the pile
const STEP = 0.03; // how far a card on the pile scales back for each card over it
const RECEDE = 0.1; // how far a covered screen scales back into the space behind

/** A card's recede, `p` of the way to `by`. */
const scrub = (
  live: Map<HTMLElement, Animation>,
  c: HTMLElement,
  p: number,
  by: number,
) => {
  if (p <= 0) {
    live.get(c)?.cancel();
    live.delete(c);
    return;
  }
  let a = live.get(c);
  if (!a) {
    a = c.animate([{ scale: 1 }, { scale: 1 - by }], {
      duration: 1000,
      fill: "both",
    });
    a.pause();
    live.set(c, a);
  }
  a.currentTime = p * 1000;
};

const drop = (live: Map<HTMLElement, Animation>) => {
  for (const a of live.values()) a.cancel();
  live.clear();
};

export function runDeck(el: HTMLElement, mode: Deck): () => void {
  if (mode === "chapters") return runChapters(el);
  if (mode === "leads") return () => {}; // the strip deals at its ends itself
  const wide = window.matchMedia("(min-width: 40rem)");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let cards: HTMLElement[] = [];
  let rest: HTMLElement[] = [];
  // Per card: where it sits in layout, its width, where it pins, and
  // where the next cell starts.
  let spots: { at: number; width: number; pin: number; next: number }[] = [];
  const live = new Map<HTMLElement, Animation>();

  const clear = () => {
    drop(live);
    for (const c of Array.from(el.children) as HTMLElement[]) {
      c.style.removeProperty("position");
      c.style.removeProperty("left");
      c.style.removeProperty("z-index");
      c.style.removeProperty("transform-origin");
      c.style.removeProperty("will-change");
      delete c.dataset.at;
    }
    cards = [];
    rest = [];
    spots = [];
  };

  /* Written in the scroll handler itself, not a frame later: the scroll
     event runs in the same rendering step as the paint that follows it,
     so the depth keeps up with the pin. */
  const depth = () => {
    const x = el.scrollLeft;
    // How much of each card, pinned, the one after it now covers. Under
    // two pixels is nothing: `offsetLeft` rounds, a screen is 1761.333 wide,
    // and a screen at rest read as a third of a pixel covered. It sat at
    // scale 0.99998, resampled, and every seam in it shimmered. Julian saw
    // it on Selected work and Cover art.
    const cover = spots.map((s) => {
      const over = s.pin + s.width - (s.next - x);
      return over < 2 ? 0 : Math.min(1, over / s.width);
    });
    // On the pile a card sinks a step for every card over it, so the pile
    // tapers evenly, the way ScrollStack's does. Julian: the stack looked
    // uneven when every covered card sank the same way.
    let over = 0;
    for (let i = cards.length - 1; i >= 0; i--) {
      over += cover[i];
      if (mode === "screens") scrub(live, cards[i], cover[i], RECEDE);
      else scrub(live, cards[i], over / cards.length, STEP * cards.length);
    }
  };

  const deal = () => {
    clear();
    if (!wide.matches || calm.matches) return;
    const kids = Array.from(el.children) as HTMLElement[];
    // Layout positions, read with nothing pinned.
    for (const k of kids) k.dataset.at = String(k.offsetLeft);
    cards =
      mode === "screens"
        ? kids
        : kids.filter((k) => k.hasAttribute("data-deck"));
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    spots = cards.map((c, i) => {
      const next = c.nextElementSibling as HTMLElement | null;
      return {
        at: c.offsetLeft,
        width: c.offsetWidth,
        pin: mode === "pile" ? pad + i * PEEK : 0,
        next: next ? next.offsetLeft : Infinity,
      };
    });
    cards.forEach((c, i) => {
      c.style.position = "sticky";
      c.style.left = `${spots[i].pin}px`;
      c.style.zIndex = String(i + 1);
      // A screen recedes about its middle; a card on the pile keeps its
      // pinned edge, so the pile's edges stay in step.
      c.style.transformOrigin = mode === "screens" ? "50% 50%" : "left center";
      c.style.willChange = "transform";
    });
    // What comes after the pile slides over it too, so it goes on top.
    const last = cards[cards.length - 1];
    rest = last ? kids.slice(kids.indexOf(last) + 1) : [];
    rest.forEach((c) => {
      c.style.position = "relative";
      c.style.zIndex = String(cards.length + 1);
    });
    depth();
  };

  deal();
  el.addEventListener("scroll", depth, { passive: true });
  wide.addEventListener("change", deal);
  calm.addEventListener("change", deal);
  window.addEventListener("resize", deal);
  // The rack (`strip-grid`) lays the same cells out again: deal again.
  const relaid = new MutationObserver(deal);
  relaid.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => {
    el.removeEventListener("scroll", depth);
    wide.removeEventListener("change", deal);
    calm.removeEventListener("change", deal);
    window.removeEventListener("resize", deal);
    relaid.disconnect();
    clear();
  };
}

/* ── chapters ──
 * The screen that holds is pinned cell by cell: each cell of it is sticky
 * at the place it has when that screen fills the window, so the cells
 * hold together, and each recedes about the middle of the screen rather
 * than its own, so they recede together. Once the next chapter covers the
 * window the screen lets go: there is nothing left to hold for, and cells
 * kept pinned would show through the gaps for the rest of the strip. */

type Card = {
  cell: HTMLElement;
  /** Its sticky offset: where it stands while the screen holds. */
  left: number;
};
type Chapter = {
  /** The scroll at which this chapter's last screen fills the window. */
  pinX: number;
  /** The cells of that screen. */
  cards: Card[];
  held: boolean;
  /** How far the next chapter has come over it, the last time it was read. */
  p: number;
};

/** A box's top on the page, by layout alone: a cell mid-arrival is
    translated, and its rectangle would say so. */
const topOf = (box: HTMLElement) => {
  let y = 0;
  for (
    let n: HTMLElement | null = box;
    n;
    n = n.offsetParent as HTMLElement | null
  )
    y += n.offsetTop;
  return y;
};

function runChapters(el: HTMLElement): () => void {
  const wide = window.matchMedia("(min-width: 40rem)");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let kids: HTMLElement[] = [];
  let chapters: Chapter[] = [];
  const live = new Map<HTMLElement, Animation>();

  const clear = () => {
    drop(live);
    for (const k of kids) {
      k.style.removeProperty("position");
      k.style.removeProperty("left");
      k.style.removeProperty("z-index");
      k.style.removeProperty("transform-origin");
      delete k.dataset.at;
    }
    kids = [];
    chapters = [];
  };

  const hold = (ch: Chapter, on: boolean) => {
    if (ch.held === on) return;
    ch.held = on;
    for (const c of ch.cards) {
      c.cell.style.position = on ? "sticky" : "relative";
      c.cell.style.left = on ? `${c.left}px` : "";
    }
  };

  const depth = () => {
    const x = el.scrollLeft;
    const vw = el.clientWidth;
    for (const ch of chapters) {
      const p = Math.min(1, Math.max(0, (x - ch.pinX) / vw));
      if (p === ch.p) continue;
      ch.p = p;
      hold(ch, p < 1);
      // Let go at the far end too: the card is off to its layout spot.
      for (const c of ch.cards) scrub(live, c.cell, p === 1 ? 0 : p, RECEDE);
    }
  };

  const deal = () => {
    clear();
    if (!wide.matches || calm.matches) return;
    kids = Array.from(el.children) as HTMLElement[];
    // Layout positions, read with nothing pinned.
    for (const k of kids) k.dataset.at = String(k.offsetLeft);
    const heads = kids.filter((k) => k.hasAttribute("data-deck"));
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const vw = el.clientWidth;
    const mid = el.clientHeight / 2;
    const top = topOf(el);
    // Every cell positioned, in order: what comes later lies over what
    // came before, and a plain cell would lie under a held one whatever
    // its order.
    kids.forEach((k, i) => {
      k.style.position = "relative";
      k.style.zIndex = String(i + 1);
    });
    // The last chapter has nothing coming over it, so it never holds.
    chapters = heads.slice(0, -1).map((head, h) => {
      const next = heads[h + 1];
      // A chapter shorter than the window holds from its start instead.
      const pinX = Math.max(head.offsetLeft - pad, next.offsetLeft - vw);
      const cards: Card[] = [];
      for (const cell of kids.slice(kids.indexOf(head), kids.indexOf(next))) {
        const left = cell.offsetLeft - pinX;
        if (left + cell.offsetWidth <= 0) continue; // never on that screen
        // About the screen's middle, from the cell's own corner.
        cell.style.transformOrigin = `${vw / 2 - left}px ${mid - (topOf(cell) - top)}px`;
        // The sticky offset counts from the content edge (measured:
        // `left: 0` held at the padding), so it is short by the padding.
        cards.push({ cell, left: left - pad });
      }
      return { pinX, cards, held: false, p: -1 };
    });
    depth();
  };

  deal();
  el.addEventListener("scroll", depth, { passive: true });
  wide.addEventListener("change", deal);
  calm.addEventListener("change", deal);
  window.addEventListener("resize", deal);
  // The rack (`strip-grid`) lays the same cells out again: deal again.
  const relaid = new MutationObserver(deal);
  relaid.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => {
    el.removeEventListener("scroll", depth);
    wide.removeEventListener("change", deal);
    calm.removeEventListener("change", deal);
    window.removeEventListener("resize", deal);
    relaid.disconnect();
    clear();
  };
}
