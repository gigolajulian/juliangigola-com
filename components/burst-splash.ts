/* ── `?splash=burst`: wordmark, a burst of frames, the hero, a preview ──
 * Julian's brief (2026-10-28): the wordmark shows, with a loader under it
 * at the foot of the screen drawn like the page's scrollbar (`.sb-thumb`,
 * v3.css) and held until everything has loaded; then a run of photographs
 * back to back, then the hero's own photograph, which
 * glides into the hero's place as the page comes up round it. The
 * homepage's opening since 2026-10-28 (Julian: "make default").
 *
 * 2026-10-30: the wordmark's letters rise out of their line; the run is
 * the portfolio's first covers (`lib/splash-run.ts`) on a quickening
 * beat, every one in the same 4:5 frame, which opens out to the hero.
 * Every other page plays the wordmark alone (`data-splash="name"`).
 *
 * Like the sheet, it is written into the page as source and run as the
 * document is read, so it touches nothing but the browser and its
 * arguments. Frames that have not loaded by their turn are left out
 * rather than shown blank.
 * ─────────────────────────────────────────────────────────────── */
export function burst(sizes: string[][], heroes: { d: string[]; l: string[] }) {
  const big = innerWidth >= 700 ? 1 : 0; // a phone takes the smaller copies
  const root = document.documentElement;
  /* `name`: every page but the homepage, which has no hero to land on and
     its own photographs to show, gets the wordmark alone (2026-10-30). */
  const alone = root.dataset.splash === "name";
  if ((root.dataset.splash !== "burst" && !alone) || root.dataset.intro !== "1") return;
  const frames = alone ? [] : sizes.map((f) => f[big]), hero = { d: heroes.d[big], l: heroes.l[big] };
  // inside the sheet's HTML block, which React leaves alone when it hydrates
  const layer = document.querySelector("#jg-intro .jg-sheet-wrap");
  if (!layer) return;

  const STAGGER = 28; // between letters of the wordmark rising
  const RISE = 620; // one letter rising out of its line
  const HOLD = 200; // the wordmark whole, once everything has loaded
  const LEAVE = 420; // one letter rising out the top, and the stagger below
  const LEAVE_STAGGER = 18;
  const BEAT = [220, 90]; // the run's cuts, first and last: it quickens as it goes
  const OPEN = 380; // the frame opening out to the whole hero
  const SIT = 150; // the hero, whole screen, before it moves
  const LAND = 1000; // the hero gliding into its place, the page coming up round it
  const CLEAR = 350; // the splash's copy of the hero giving way to the page's own
  const LOAD = 3500; // the longest the wordmark waits for the loader to fill
  const MAX = 6000; // the whole splash, whatever has not arrived by then is skipped
  const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
  const OUT_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)"; // the page's own rise (`--land`, splash.css)
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /* Julian's pick (2026-10-30): the letters rise out of their line, one
     after another, "Julian" then "Gigola", and the tracking closes up as
     they settle. Each word clips at its own line, so a letter is never
     seen below it. No fades on the type, as on the cover. */
  const word = document.createElement("div");
  word.className = "jg-burst-word";
  word.setAttribute("aria-label", "Julian Gigola");
  const letters: HTMLElement[] = [];
  for (const w of ["Julian", "Gigola"]) {
    const line = document.createElement("span");
    line.className = "jg-burst-line";
    for (const ch of w) {
      const l = document.createElement("span");
      l.textContent = ch;
      line.append(l);
      letters.push(l);
    }
    word.append(line);
  }
  const bar = document.createElement("div");
  bar.className = "jg-burst-bar";
  const fill = document.createElement("i");
  bar.append(fill);
  layer.append(word, bar);

  /* One image per frame, stacked and decoded ahead, so a cut is a switch
     of opacity and never waits on the network or the decoder. */
  const shown = new Set<HTMLImageElement>();
  const stack = (src: string, cls: string) => {
    const i = document.createElement("img");
    i.className = cls;
    i.alt = "";
    i.src = src;
    i.decode().then(() => shown.add(i), () => {}).finally(() => done++);
    layer.append(i);
    return i;
  };
  let done = 0, loaded = document.readyState === "complete";
  addEventListener("load", () => (loaded = true), { once: true });
  const pics = frames.map((f) => stack(f, "jg-burst-pic"));
  const last = alone ? null : stack(root.dataset.theme === "light" ? hero.l : hero.d, "jg-burst-hero");
  const show = (i: HTMLImageElement | null) => {
    for (const p of pics) p.style.opacity = p === i ? "1" : "0";
    if (last) last.style.opacity = last === i ? "1" : "0";
  };

  // the shown one of the pair (v3d or v3l, by theme)
  const real = () => [...document.querySelectorAll<HTMLImageElement>(".a-cover .slides img.on")].find((i) => i.offsetWidth > 0);

  /* The loader: what has arrived of the frames, the hero and the page,
     drawn eased so it glides rather than steps. */
  let shownP = 0, filling = true;
  const total = frames.length + (last ? 1 : 0) + 1;
  const tick = () => {
    const p = (done + (loaded ? 1 : 0)) / total;
    shownP += (p - shownP) * 0.12;
    fill.style.transform = `scaleX(${shownP})`;
    if (filling) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  (async () => {
    const start = performance.now(), left = () => start + MAX - performance.now();
    letters.forEach((l, i) =>
      l.animate([{ transform: "translateY(105%)" }, { transform: "none" }],
        { duration: RISE, delay: i * STAGGER, easing: OUT_EASE, fill: "forwards" }));
    const risen = RISE + (letters.length - 1) * STAGGER;
    word.animate([{ letterSpacing: "0.02em" }, { letterSpacing: "-0.05em" }], { duration: risen + HOLD, easing: OUT_EASE, fill: "forwards" });
    bar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: EASE, fill: "forwards" });
    await sleep(risen + HOLD);
    while (shownP < 0.995 && performance.now() - start < LOAD) await sleep(30);
    letters.forEach((l, i) =>
      l.animate([{ transform: "none" }, { transform: "translateY(-105%)" }],
        { duration: LEAVE, delay: i * LEAVE_STAGGER, easing: EASE, fill: "forwards" }));
    bar.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: EASE, fill: "forwards" });
    await sleep(LEAVE + (letters.length - 1) * LEAVE_STAGGER * 0.6);
    filling = false;

    /* Anywhere but the homepage: the name was the whole opening. */
    if (!last) {
      root.dataset.intro = "half";
      root.dataset.splashed = "";
      document.getElementById("jg-intro")?.classList.add("jg-intro-open");
      layer.querySelector(".jg-sheet-ground")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLEAR, easing: EASE, fill: "forwards" });
      await sleep(CLEAR);
      root.removeAttribute("data-intro");
      return;
    }

    /* The run, on a beat that quickens from the first cut to the last.
       Every frame had the wordmark's time to load; one that still has not
       is left out, but the beat is counted over the ones that play, so
       the rhythm holds whatever is skipped. */
    const run = pics.filter((p) => shown.has(p));
    if (left() > 2500)
      for (let k = 0; k < run.length; k++) {
        show(run[k]);
        await sleep(BEAT[0] + ((BEAT[1] - BEAT[0]) * k) / Math.max(1, run.length - 1));
      }

    /* The hero, once it is decoded (not long: it was asked for first
       thing). It comes up in the run's 4:5 frame and the frame opens out
       to the whole photograph, then holds while the page's own copy
       arrives. */
    while (!shown.has(last) && left() > SIT + LAND + CLEAR) await sleep(30);
    const whole = shown.has(last); // if it never came, the page simply comes up
    if (whole) {
      const f = (run.at(-1) ?? pics[0])?.getBoundingClientRect();
      const b = last.getBoundingClientRect(), a = last.naturalWidth / last.naturalHeight;
      const w = Math.min(b.width, b.height * a), ht = w / a;
      const cl = b.left + (b.width - w) / 2, ct = b.top + (b.height - ht) / 2;
      show(last);
      if (f && f.width > 0) {
        last.animate([
          { clipPath: `inset(${f.top - b.top}px ${b.right - f.right}px ${b.bottom - f.bottom}px ${f.left - b.left}px)` },
          { clipPath: `inset(${ct - b.top}px ${b.right - cl - w}px ${b.bottom - ct - ht}px ${cl - b.left}px)` },
        ], { duration: OPEN, easing: EASE, fill: "forwards" });
        await sleep(OPEN);
      }
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
      const cl = b.left + (b.width - w) / 2, ct = b.top + (b.height - ht) / 2;
      /* The same glide as a box going from the whole photograph to the
         hero's, cropping as \`cover\` with the hero's object-position would,
         but drawn with transform and clip-path on the photograph's own
         box, which never moves: no layout shift (CLS). Sampled, and the
         one easing runs over the samples, so the path and timing match. */
      const pos = (h ? getComputedStyle(h).objectPosition : "50% 50%").split(" ");
      const at = (v = "50%", room: number) => (v.endsWith("%") ? (room * parseFloat(v)) / 100 : parseFloat(v));
      const lerp = (x: number, y: number, p: number) => x + (y - x) * p;
      const frames: Keyframe[] = [];
      for (let i = 0; i <= 24; i++) {
        const p = i / 24;
        const bl = lerp(cl, r.left, p), bt = lerp(ct, r.top, p), bw = lerp(w, r.width, p), bh = lerp(ht, r.height, p);
        const dw = Math.max(bw, bh * a), dh = dw / a, k = dw / w;
        const tx = bl + at(pos[0], bw - dw) - b.left - k * (cl - b.left), ty = bt + at(pos[1], bh - dh) - b.top - k * (ct - b.top);
        const L = (bl - b.left - tx) / k, T = (bt - b.top - ty) / k;
        frames.push({
          transform: `translate(${tx}px, ${ty}px) scale(${k})`,
          clipPath: `inset(${T}px ${b.width - L - bw / k}px ${b.height - T - bh / k}px ${L}px)`,
        });
      }
      last.style.transformOrigin = "0 0";
      last.animate(frames, { duration: LAND, easing: EASE, fill: "forwards" });
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
