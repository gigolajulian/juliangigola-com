/* ── `?splash=burst`: wordmark, a burst of frames, the hero, a preview ──
 * Julian's brief (2026-10-28): the wordmark shows, with a loader under it
 * at the foot of the screen drawn like the page's scrollbar (`.sb-thumb`,
 * v3.css) and held until everything has loaded; then a run of photographs
 * back to back, then the hero's own photograph, which
 * glides into the hero's place as the page comes up round it. The
 * homepage's opening since 2026-10-28 (Julian: "make default").
 *
 * Like the sheet, it is written into the page as source and run as the
 * document is read, so it touches nothing but the browser and its
 * arguments. Frames that have not loaded by their turn are left out
 * rather than shown blank.
 * ─────────────────────────────────────────────────────────────── */
export function burst(sizes: string[][], heroes: { d: string[]; l: string[] }) {
  const big = innerWidth >= 700 ? 1 : 0; // a phone takes the smaller copies
  const frames = sizes.map((f) => f[big]), hero = { d: heroes.d[big], l: heroes.l[big] };
  const root = document.documentElement;
  if (root.dataset.splash !== "burst" || root.dataset.intro !== "1") return;
  // inside the sheet's HTML block, which React leaves alone when it hydrates
  const layer = document.querySelector("#jg-intro .jg-sheet-wrap");
  if (!layer) return;

  const IN = 450, HOLD = 650, OUT = 300; // the wordmark
  const CUT = 140; // each frame of the burst
  const SIT = 450; // the hero, whole screen, before it moves
  const LAND = 1000; // the hero gliding into its place, the page coming up round it
  const CLEAR = 350; // the splash's copy of the hero giving way to the page's own
  const LOAD = 3500; // the longest the wordmark waits for the loader to fill
  const MAX = 6000; // the whole splash, whatever has not arrived by then is skipped
  const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const word = document.createElement("div");
  word.className = "jg-burst-word";
  word.textContent = "Julian Gigola";
  const bar = document.createElement("div");
  bar.className = "jg-burst-bar";
  const fill = document.createElement("i");
  bar.append(fill);
  layer.append(word, bar);

  /* One image per frame, stacked and decoded ahead, so a cut is a switch
     of opacity and never waits on the network or the decoder. */
  const shown = new Set<HTMLImageElement>();
  const stack = (src: string) => {
    const i = document.createElement("img");
    i.className = "jg-burst-pic";
    i.alt = "";
    i.src = src;
    i.decode().then(() => shown.add(i), () => {}).finally(() => done++);
    layer.append(i);
    return i;
  };
  let done = 0, loaded = document.readyState === "complete";
  addEventListener("load", () => (loaded = true), { once: true });
  const pics = frames.map(stack);
  const last = stack(root.dataset.theme === "light" ? hero.l : hero.d);
  const show = (i: HTMLImageElement | null) => {
    for (const p of [...pics, last]) p.style.opacity = p === i ? "1" : "0";
  };

  // the shown one of the pair (v3d or v3l, by theme)
  const real = () => [...document.querySelectorAll<HTMLImageElement>(".a-cover .slides img.on")].find((i) => i.offsetWidth > 0);

  /* The loader: what has arrived of the frames, the hero and the page,
     drawn eased so it glides rather than steps. */
  let shownP = 0, filling = true;
  const total = frames.length + 2;
  const tick = () => {
    const p = (done + (loaded ? 1 : 0)) / total;
    shownP += (p - shownP) * 0.12;
    fill.style.transform = `scaleX(${shownP})`;
    if (filling) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  (async () => {
    const start = performance.now(), left = () => start + MAX - performance.now();
    const fade = [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }];
    word.animate(fade, { duration: IN, easing: EASE, fill: "forwards" });
    bar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: IN, easing: EASE, fill: "forwards" });
    await sleep(IN + HOLD);
    while (shownP < 0.995 && performance.now() - start < LOAD) await sleep(30);
    word.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT, easing: EASE, fill: "forwards" });
    bar.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT, easing: EASE, fill: "forwards" });
    await sleep(OUT);
    filling = false;

    for (const p of pics) {
      if (!shown.has(p) || left() < 2500) continue;
      show(p);
      await sleep(CUT);
    }

    /* The hero, whole screen, once it is decoded (not long: it was asked
       for first thing), then held while the page's own copy arrives. */
    while (!shown.has(last) && left() > SIT + LAND + CLEAR) await sleep(30);
    const whole = shown.has(last); // if it never came, the page simply comes up
    if (whole) {
      show(last);
      await sleep(SIT);
      for (; left() > LAND + CLEAR; await sleep(30)) {
        const h = real();
        if (!h || (h.complete && h.naturalWidth > 0)) break;
      }
    }

    /* Into the hero's place. It starts as the whole photograph, in a box of
       its own shape (so `cover` crops nothing yet), and that box glides to
       the hero's, taking on the hero's crop as it goes. Meanwhile the
       ground thins so the page comes up round it, and the cover's nav and
       name come up over it (`data-landing`, splash.css). */
    const h = real(), r = (h ?? document.querySelector(".a-cover .slides"))?.getBoundingClientRect();
    root.dataset.landing = "";
    // the ground thins once the photograph has mostly reached its frame, so the page's copy never shows round a smaller one
    layer.querySelector(".jg-sheet-ground")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LAND * 0.5, delay: LAND * 0.5, easing: EASE, fill: "forwards" });
    if (whole && r && r.width > 0) {
      const b = last.getBoundingClientRect(), a = last.naturalWidth / last.naturalHeight;
      const w = Math.min(b.width, b.height * a), ht = w / a;
      if (h) last.style.objectPosition = getComputedStyle(h).objectPosition;
      last.style.objectFit = "cover";
      last.animate(
        [
          { left: `${b.left + (b.width - w) / 2}px`, top: `${b.top + (b.height - ht) / 2}px`, width: `${w}px`, height: `${ht}px` },
          { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` },
        ],
        { duration: LAND, easing: EASE, fill: "forwards" },
      );
    }
    await sleep(LAND);
    root.dataset.landed = ""; // the type comes in now the photograph is in place (splash.css)
    root.dataset.intro = "half";
    root.dataset.splashed = "";
    document.getElementById("jg-intro")?.classList.add("jg-intro-open");
    last.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLEAR, easing: EASE, fill: "forwards" });
    await sleep(CLEAR);
    root.removeAttribute("data-intro");
    // the name, the buttons and the nav are still finishing their moves (splash.css)
    await sleep(1500);
    delete root.dataset.landing;
    delete root.dataset.landed;
  })();
}
