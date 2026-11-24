/* ── the name splash: the wordmark alone, every page but the homepage ──
 * The letters rise out of their line, a loader under it at the foot of the
 * screen drawn like the page's scrollbar (`.sb-thumb`, v3.css) fills as the
 * page loads, then the wordmark gives way to the page (`data-splash="name"`).
 * The homepage plays `split-splash.ts`. Written into the page as source and
 * run as the document is read, so it touches nothing but the browser.
 * ─────────────────────────────────────────────────────────────── */
export function burst() {
  const root = document.documentElement;
  /* Every page but the homepage (which plays split-splash.ts) gets the wordmark alone. */
  if (root.dataset.splash !== "name" || root.dataset.intro !== "1") return;
  // inside the sheet's HTML block, which React leaves alone when it hydrates
  const layer = document.querySelector("#jg-intro .jg-sheet-wrap");
  if (!layer) return;

  /* About 3.2s on a desktop (owner pick, do not tune). */
  const STAGGER = 18; // between letters of the wordmark rising
  const RISE = 460; // one letter rising out of its line
  const HOLD = 80; // the wordmark whole, once everything has loaded
  const CLEAR = 220; // the splash's copy of the hero giving way to the page's own
  const LOAD = 3500; // the longest the wordmark waits for the loader to fill
  const EASE = "cubic-bezier(0.77, 0, 0.175, 1)";
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

  /* The loader: the page's `load`, drawn eased so it glides rather than steps. */
  let loaded = document.readyState === "complete";
  addEventListener("load", () => (loaded = true), { once: true });
  let shownP = 0, filling = true;
  const tick = () => {
    const p = loaded ? 1 : 0;
    shownP += (p - shownP) * 0.22;
    fill.style.transform = `scaleX(${shownP})`;
    if (filling) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  (async () => {
    const start = performance.now();
    letters.forEach((l, i) =>
      l.animate([{ transform: "translateY(105%)" }, { transform: "none" }],
        { duration: RISE, delay: i * STAGGER, easing: OUT_EASE, fill: "forwards" }));
    const risen = RISE + (letters.length - 1) * STAGGER;
    bar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: EASE, fill: "forwards" });
    await sleep(risen + HOLD);
    while (shownP < 0.995 && performance.now() - start < LOAD) await sleep(30);
    bar.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: EASE, fill: "forwards" });
    filling = false;

    /* Anywhere but the homepage: the name was the whole opening. */
    root.dataset.intro = "half";
    root.dataset.splashed = "";
    document.getElementById("jg-intro")?.classList.add("jg-intro-open");
    for (const el of [layer.querySelector(".jg-sheet-ground"), word])
      el?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLEAR, easing: EASE, fill: "forwards" });
    await sleep(CLEAR);
    root.removeAttribute("data-intro");
  })();
}
