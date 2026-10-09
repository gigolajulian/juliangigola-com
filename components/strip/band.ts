import { rubberband } from "@/lib/utils";
import { leadOn } from "./lead";
import type { Mover } from "./motion";
import { HOLD, LEAVE_AFTER, RELAX, STRETCH, WHEEL } from "./shared";

/* ── the band ──
   Push past either end and the strip does not stop dead, it gives a
   little and comes back - the resistance Julian asked for at the ends.
   `over` is the raw pull past the end, positive at the right and
   negative at the left; the band shown is that pull through
   `rubberband`, so the first pixels move it and the later ones barely
   do. It drains under RELAX whenever the pushing stops. And at the
   right-hand end it is also the count: keep pushing past LEAVE_AFTER of
   it and the sequence leads on to the next page. So the stretch is
   the receipt for the count - you can see how far along you are. */

/* ── the wall ──
   An end with nowhere to lead on is a wall, and a push into it is one
   bounce: the strip gives a little and springs back past rest, the
   way a thrown thing meets a spring, and that is the whole answer
   that nothing is there. It was the band, and a trackpad keeps
   sending its swipe for a second as the fling runs out, so the band
   climbed a step a notch to its 160px stop and sat there until the
   fingers' momentum ended (Julian: scrolling left on the homepage is
   stuttery). The bounce is the browser's own animation, run off the
   main thread, and a swipe gets one however long it keeps sending.

   The curve is a damped spring's response to a knock (damping 0.5,
   out at 120ms, back past rest by a sixth, still by 800ms), sampled. */
const WALL = [0, 0.403, 0.694, 0.881, 0.979, 1.0, 0.961, 0.878, 0.764, 0.633, 0.496, 0.362, 0.238, 0.128, 0.035, -0.039, -0.094, -0.132, -0.154, -0.163, -0.161, -0.15, -0.133, -0.113, -0.091, -0.069, -0.048, -0.028, -0.012, 0.001, 0.012, 0.019, 0];
const WALL_MS = 800;

export type Band = {
  /** Whether the end that way is a way into the work (`lead-window.tsx`). */
  door: (dir: 1 | -1) => boolean;
  /** The pull past the end, `dir`, that leads on. */
  after: (dir: 1 | -1) => number;
  bounce: (dir: 1 | -1, speed: number) => void;
  release: () => void;
  push: (by: number) => void;
  leave: (dir: 1 | -1) => void;
};

export function createBand(m: Mover): Band {
  const { el } = m;
  /* Through the window it is one scroll past it, either way (Julian:
     seamless): the word already said what is next, so there is nothing
     to make sure of. Everywhere else the band asks for a persistent
     push (`lead-window.tsx`). */
  const door = (dir: 1 | -1) =>
    // A cell of no width, but drawn: none under a finger on a phone.
    (dir > 0
      ? m.win
        ? m.drawn
        : // Not in yet (`defer`): looked for until it is.
          (m.drawn = !!(m.win = el.querySelector<HTMLElement>(":scope > [data-lead-window]"))?.getClientRects().length)
      : m.prevStart && m.prevHref === "/");
  /* The portfolio stacking over the home (`data-stack`, the default):
     past the last screen the wheel carries the portfolio's card in as
     it carries a screen, the strip's gain a notch, all the way across
     (Julian: on scroll as well from the last page of home). */
  const stacked = (dir: 1 | -1) =>
    dir > 0 && door(1) && "stack" in document.documentElement.dataset;
  const after = (dir: 1 | -1) =>
    stacked(dir) ? innerWidth / WHEEL : door(dir) ? 90 : LEAVE_AFTER;

  /* Drawn with the `translate` property and not `transform`. This is the
     one trap in here: `strip-scroll` in `globals.css` animates
     `transform` for both the arrival and the `[data-leaving]` exit, and an
     inline transform would outrank the exit - the strip would snap back
     to zero and leave from there. The two properties compose instead, so
     the exit slide simply starts from wherever the band had got to. */
  const paint = () => {
    if (m.leaving) return;
    // Three notches read 48, 94 and 136px, so the band is still growing
    // at the moment it goes. It was half that and Julian said it did not
    // feel like a rubber band: give that cannot be seen is a stop.
    const pull = m.eased && m.over ? rubberband(m.over, m.width, 0.5) : 0;
    /* Into the window, the last screen is the card on top and slides
       off the portfolio under it by as much as it shows (`lead-pane`),
       up to three tenths of the screen. Only that screen: the strip
       moved whole took the pane out of its own clip. A cubic, so it
       gives easily and then stiffens towards the count, and the
       crossing is a detent given way (Julian: a tiny bit of
       resistance). */
    /* Not under reduced motion: the count still leads on, but the
       last screen does not slide or sink with the pull. */
    if (m.eased && m.over > 0 && door(1) && m.win) {
      const shown = Math.round(
        stacked(1)
          ? Math.min(innerWidth, m.over * WHEEL)
          : innerWidth * 0.3 * (1 - (1 - Math.min(1, m.over / after(1))) ** 3),
      );
      const last = m.win.previousElementSibling as HTMLElement;
      /* `data-stack` (the default; `?stack=0` opts out): the portfolio comes in over the last screen, which
         sinks back as the deck's screens do, instead of sliding off. */
      if ("stack" in document.documentElement.dataset) {
        last.style.scale = String(1 - (0.1 * shown) / innerWidth);
        /* The homepage's rail gives way as the card comes over it. Set on
           the rail, the one thing that reads it: on the band it was
           inherited by the whole homepage, which restyled every notch. */
        el.closest<HTMLElement>(".strip-band")?.querySelector<HTMLElement>(".strip-rail")?.style.setProperty("--lead-in", (shown / innerWidth).toFixed(3));
      } else last.style.translate = `${-shown}px`;
      m.win.style.setProperty("--lead-pull", `${shown}px`);
      return;
    }
    const shift = pull ? -Math.max(-STRETCH, Math.min(STRETCH, pull)) : 0;
    el.style.translate = shift ? `${shift}px` : "";
  };

  const bounce = (dir: 1 | -1, speed: number) => {
    if (!m.eased || m.wall || m.room() < 1) return;
    const reach = -dir * Math.min(72, 24 + speed * 0.5);
    const a = el.animate(
      WALL.map((k) => ({ translate: `${(k * reach).toFixed(1)}px` })),
      { duration: WALL_MS },
    );
    m.wall = a;
    const done = () => {
      if (m.wall === a) m.wall = null;
    };
    a.finished.then(done, done);
  };

  /** Lets the band go: CSS springs it back (`[data-release]` in
      `globals.css`), so nothing here paints the return frame by frame. */
  const release = () => {
    if (m.leaving || "release" in el.dataset) return;
    el.dataset.release = "";
    el.style.translate = "";
    if (m.win) {
      const last = m.win.previousElementSibling as HTMLElement;
      last.style.translate = "";
      last.style.scale = "";
      el.closest<HTMLElement>(".strip-band")?.querySelector<HTMLElement>(".strip-rail")?.style.removeProperty("--lead-in");
      m.win.style.setProperty("--lead-pull", "0px");
    }
  };
  /** The band's own loop, apart from the strip's: it holds while the
      pushing goes on and drains once it stops. Its own loop because the
      strip's writes `scrollLeft` every frame, and a strip loop kept up for
      the band would overwrite a keyboard or touch scroll for as long as
      the band took to settle - seen in the test, where a jump to the end
      was put straight back to the start. */
  const relax = (now: number) => {
    if (now - m.pushed > HOLD) {
      /* Let go a fifth of the way in or more, and the card carries on
         over, as a screen does (`settle`); less, and it goes back. */
      if (m.over > 0 && stacked(1) && m.over * WHEEL > innerWidth * 0.2) {
        leave(1);
        if (m.leaving) {
          m.band = 0;
          return;
        }
      }
      release();
      // The count drains on its own clock, unseen.
      m.over *= Math.exp(-16 / RELAX);
      if (Math.abs(m.over) < 1) m.over = 0;
    }
    m.band = m.over ? requestAnimationFrame(relax) : 0;
  };
  const push = (by: number) => {
    /* A strip with one screen in it and nowhere to lead on has nothing
       to stretch against: the band was give with nothing behind it,
       which reads as the page wobbling. Julian asked for it gone. */
    if (m.room() < 1 && !(by > 0 ? m.nextHref : m.prevHref)) return;
    m.over += by;
    m.pushed = performance.now();
    delete el.dataset.release;
    paint();
    if (!m.band) m.band = requestAnimationFrame(relax);
  };

  /* ── the way on ──
     Push past the right-hand end and the band shows it; keep pushing and
     the sequence leads on: the strip slides off to the left and the next
     page's strip arrives from the right (`strip-scroll` in
     `globals.css`). Stop pushing and the band relaxes and the count with
     it, so a wheel that merely arrives at the end and overshoots goes
     nowhere, and only one that persists does. Julian asked for exactly
     that: a little resistance, and if the scrolling persists, the next
     project.

     Arriving does not count as asking to leave again. The strip a visitor
     has just been carried to mounts with the wheel still turning, and
     without this one hard spin skipped a project and then the one after
     it. Half a second of quiet makes each step a decision. */
  const leave = (dir: 1 | -1) => {
    const href = dir > 0 ? m.nextHref : m.prevHref;
    /* Not for the portfolio's card: it takes a full window of pushing
       past the last screen, which no spin that led here can be. Kept, it
       left the card over the whole window until the next notch. */
    if (!href || m.leaving || (!stacked(dir) && performance.now() - m.arrived < 500)) return;
    /* The end of a strip whose later screens have not come in yet is not
       its end: on the homepage's hero alone, a push was the way out. */
    if (dir > 0 && m.heldBack.current) return;
    /* Never off a page with words typed into its form: the contact form
       keeps no state, and a drag across its intro or a spin over its
       steps took a half written inquiry to About and back empty. The
       band still gives; the bar still goes. */
    if (
      [...el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input:not([hidden], [type=hidden], [type=radio], [type=checkbox]), textarea",
      )].some((f) => f.value.trim())
    )
      return;
    m.leaving = true;
    // The band holds where it is and the slide starts from it.
    if (m.band) cancelAnimationFrame(m.band);
    m.band = 0;
    leadOn(m, dir, href, door);
  };

  return { door, after, bounce, release, push, leave };
}
