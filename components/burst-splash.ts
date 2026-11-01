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
 * beat, every one in the same 4:5 frame, which glides into the hero.
 * Every other page plays the wordmark alone (`data-splash="name"`).
 * The wordmark stays where it is and the run comes up over it.
 *
 * Like the sheet, it is written into the page as source and run as the
 * document is read, so it touches nothing but the browser and its
 * arguments. Frames that have not loaded by their turn are left out
 * rather than shown blank.
 * ─────────────────────────────────────────────────────────────── */
export function burst(sizes: string[][], heroes: { d: [number, string][]; l: [number, string][] }) {
  const big = innerWidth >= 700 ? 1 : 0; // a phone takes the smaller copies
  const root = document.documentElement;
  /* `name`: every page but the homepage, which has no hero to land on and
     its own photographs to show, gets the wordmark alone (2026-10-30). */
  const alone = root.dataset.splash === "name";
  if ((root.dataset.splash !== "burst" && !alone) || root.dataset.intro !== "1") return;
  // the hero at the width the page's srcset picks: the window in device pixels, rounded up the ladder
  const px = innerWidth * devicePixelRatio, rung = (l: [number, string][]) => (l.find(([w]) => w >= px) ?? l[l.length - 1])[1];
  const frames = alone ? [] : sizes.map((f) => f[big]), hero = { d: rung(heroes.d), l: rung(heroes.l) };
  // inside the sheet's HTML block, which React leaves alone when it hydrates
  const layer = document.querySelector("#jg-intro .jg-sheet-wrap");
  if (!layer) return;

  const STAGGER = 28; // between letters of the wordmark rising
  const RISE = 620; // one letter rising out of its line
  const HOLD = 200; // the wordmark whole, once everything has loaded
  const DROP = 760; // the first frame tipping in and settling flat over the wordmark
  const BEAT = [220, 90]; // the run's cuts, first and last: it quickens as it goes
  const LAND = 1100; // the hero gliding from the frame into its place, the page coming up round it
  const CLEAR = 350; // the splash's copy of the hero giving way to the page's own
  const LOAD = 3500; // the longest the wordmark waits for the loader to fill
  const MAX = 6000; // the whole splash, whatever has not arrived by then is skipped
  const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
  const OUT_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)"; // the page's own rise (`--land`, splash.css)
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /* Julian's pick (2026-10-30): the letters rise out of their line, one
     after another, "Julian" then "Gigola", already at their final
     tracking, and then the name holds still. Each word clips at its own line, so a letter is never
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
    i.fetchPriority = "high"; // ahead of the page's own pictures, none of which show until the splash is done
    i.src = src;
    i.decode().then(() => shown.add(i), () => {}).finally(() => done++);
    layer.append(i);
    return i;
  };
  /* The page's part of the loader is the page having hydrated, not its
     `load`: that waits on every lazy picture the browser counts as near
     the fold, which on a slow phone ran past `LOAD`, so the wordmark held
     its 3.5s and the run was skipped entirely (2026-10-31). */
  let done = 0, loaded = document.readyState === "complete" || root.hasAttribute("data-ready");
  const ready = () => (loaded = true);
  addEventListener("load", ready, { once: true });
  addEventListener("jg-ready", ready, { once: true });
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
    bar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: EASE, fill: "forwards" });
    await sleep(risen + HOLD);
    while (shownP < 0.995 && performance.now() - start < LOAD) await sleep(30);
    /* Julian (2026-10-31): the wordmark never animates out. It stays put
       and the run's frames come up over it, so it goes under the photos. */
    bar.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: EASE, fill: "forwards" });
    filling = false;

    /* Anywhere but the homepage: the name was the whole opening. */
    if (!last) {
      root.dataset.intro = "half";
      root.dataset.splashed = "";
      document.getElementById("jg-intro")?.classList.add("jg-intro-open");
      for (const el of [layer.querySelector(".jg-sheet-ground"), word])
        el?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLEAR, easing: EASE, fill: "forwards" });
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
        /* Julian (2026-10-31): the first frame stacks over the name in 3D,
           coming down from just in front of the camera, a little turned,
           and settling flat on top of it. No flip, no shadow. */
        if (k === 0) {
          run[0].animate([
            { transform: "perspective(1400px) translate3d(0, -3%, 260px) rotateX(-7deg) rotateY(5deg) rotateZ(-2deg)", opacity: 0 },
            { opacity: 1, offset: 0.3 },
            { transform: "perspective(1400px) translate3d(0, 0, 0) rotateX(0) rotateY(0) rotateZ(0)", opacity: 1 },
          ], { duration: DROP, easing: OUT_EASE });
          await sleep(DROP);
        }
        await sleep(BEAT[0] + ((BEAT[1] - BEAT[0]) * k) / Math.max(1, run.length - 1));
      }

    /* The hero, once it is decoded (not long: it was asked for first
       thing), cut into the run's 4:5 frame, and from there one move into
       its place on the page (Julian, 2026-10-31: no opening out to the
       whole photograph and no pause on the way). */
    while (!shown.has(last) && left() > LAND + CLEAR) await sleep(30);
    const whole = shown.has(last); // if it never came, the page simply comes up
    for (; whole && left() > LAND + CLEAR; await sleep(30)) {
      const h = real();
      if (!h || (h.complete && h.naturalWidth > 0)) break;
    }

    /* The box glides from the frame to the hero's, cropping as `cover`
       with the hero's object-position would, drawn with transform and
       clip-path on the photograph's own box, which never moves: no layout
       shift (CLS). Sampled, and the one easing runs over the samples, so
       the path and timing match. Meanwhile the ground thins so the page
       comes up round it, and the cover's nav and name come up over it
       (`data-landing`, splash.css). */
    const h = real(), r = (h ?? document.querySelector(".a-cover .slides"))?.getBoundingClientRect();
    const f = (run.at(-1) ?? pics[0])?.getBoundingClientRect();
    root.dataset.landing = "";
    layer.querySelector(".jg-sheet-ground")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LAND * 0.5, delay: LAND * 0.5, easing: EASE, fill: "forwards" });
    if (whole && r && r.width > 0 && f && f.width > 0) {
      const b = last.getBoundingClientRect(), a = last.naturalWidth / last.naturalHeight;
      const w = Math.min(b.width, b.height * a), ht = w / a;
      const cl = b.left + (b.width - w) / 2, ct = b.top + (b.height - ht) / 2;
      const pos = (h ? getComputedStyle(h).objectPosition : "50% 50%").split(" ");
      const at = (v = "50%", room: number) => (v.endsWith("%") ? (room * parseFloat(v)) / 100 : parseFloat(v));
      const lerp = (x: number, y: number, p: number) => x + (y - x) * p;
      const frames: Keyframe[] = [];
      for (let i = 0; i <= 24; i++) {
        const p = i / 24;
        const bl = lerp(f.left, r.left, p), bt = lerp(f.top, r.top, p), bw = lerp(f.width, r.width, p), bh = lerp(f.height, r.height, p);
        const dw = Math.max(bw, bh * a), dh = dw / a, k = dw / w;
        const tx = bl + at(pos[0], bw - dw) - b.left - k * (cl - b.left), ty = bt + at(pos[1], bh - dh) - b.top - k * (ct - b.top);
        const L = (bl - b.left - tx) / k, T = (bt - b.top - ty) / k;
        frames.push({
          transform: `translate(${tx}px, ${ty}px) scale(${k})`,
          clipPath: `inset(${T}px ${b.width - L - bw / k}px ${b.height - T - bh / k}px ${L}px)`,
        });
      }
      last.style.transformOrigin = "0 0";
      last.animate(frames, { duration: LAND, easing: EASE, fill: "both" });
      show(last);
      /* The name is wholly under the frame as the glide starts; on a phone
         the hero's place is far shorter than the frame, so the glide would
         uncover it. It goes now, unseen, and never shows twice. */
      word.style.opacity = "0";
    }
    await sleep(LAND);
    root.dataset.landed = ""; // the type comes in now the photograph is in place (splash.css)
    root.dataset.intro = "half";
    root.dataset.splashed = "";
    document.getElementById("jg-intro")?.classList.add("jg-intro-open");
    // the name already went as the glide began; only without a glide is it still up to clear
    for (const el of word.style.opacity === "0" ? [last] : [last, word]) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLEAR, easing: EASE, fill: "forwards" });
    await sleep(CLEAR);
    root.removeAttribute("data-intro");
    // the name, the buttons and the nav are still finishing their moves (splash.css)
    await sleep(1500);
    delete root.dataset.landing;
    delete root.dataset.landed;
  })();
}
