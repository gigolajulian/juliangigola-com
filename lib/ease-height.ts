/* Julian: when the booking card or the inquiry card changes height (a
   day's times opening, week to month, loading to loaded, a step of the
   form), it eases to the new height instead of jumping. Watches the box;
   on a change it plays from the height on screen to the box's own height
   and lets go, so the box stays sized by its content. A change mid-way
   picks up from where it is. A box held to a height by its layout (the
   desktop card) never changes, so nothing plays there. Returns the
   cleanup. */
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function easeHeight(el: HTMLElement, ms = 380): () => void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  let target = el.offsetHeight;
  let run: Animation | null = null;
  let from = target;
  const play = (a: number, b: number) => {
    const r = el.animate([{ height: `${a}px` }, { height: `${b}px` }], { duration: ms, easing: EASE });
    r.onfinish = () => {
      if (run === r) run = null;
    };
    return r;
  };
  const ro = new ResizeObserver(() => {
    const shown = el.getBoundingClientRect().height;
    const at = run?.currentTime ?? null;
    run?.cancel();
    // The box's own height, with nothing playing on it.
    const own = el.offsetHeight;
    if (run && Math.abs(own - target) < 2) {
      // Its own frames: carry on where it was.
      run = play(from, target);
      run.currentTime = at;
      return;
    }
    run = null;
    if (Math.abs(own - shown) < 2) return void (target = own);
    from = shown;
    target = own;
    run = play(from, target);
  });
  ro.observe(el);
  return () => {
    ro.disconnect();
    run?.cancel();
  };
}
