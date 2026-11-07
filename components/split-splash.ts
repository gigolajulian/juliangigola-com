/* ── `?splash=split`: the name parts, a window of frames opens into the page ──
 * Julian's reference (2026-11-07, "Video Project 4.mp4", a MONO studio
 * opener): the name comes up; the two words part round a window and the
 * run cuts fast inside it. Round two (Julian: "too small", "not
 * seamless"): the name is the cover's own name at its own size, and the
 * window's last frame is the hero, which opens out to fill the cover while
 * each word glides onto its place in the cover's name. Nothing is swapped
 * or faded at the hand-over: the splash ends on exactly what the page
 * shows. Preview only, behind the flag.
 *
 * Written into the page as source and run as the document is read, like
 * the burst (`intro.tsx`): it touches nothing but the browser and its
 * arguments. A frame that has not decoded by its turn is left out.
 * ─────────────────────────────────────────────────────────────── */
export function split(sizes: string[][], heroes: { d: [number, string][]; l: [number, string][] }) {
  const root = document.documentElement;
  if (root.dataset.splash !== "split" || root.dataset.intro !== "1") return;
  const layer = document.querySelector<HTMLElement>("#jg-intro .jg-sheet-wrap");
  if (!layer) return;

  const UP = 500; // the name coming up from dim
  const PART = 520; // the words parting, the window opening
  const BEAT = 120; // one frame in the window
  const HOLD = 260; // the hero in the window before it opens
  const OPEN = 1000; // the window opening to the cover, the words landing
  const WAIT = 2500; // the longest the name waits for the frames
  const OUT = "cubic-bezier(0.23, 1, 0.32, 1)"; // `--ease-out`, tokens.css
  const MOVE = "cubic-bezier(0.77, 0, 0.175, 1)"; // `--ease-move`
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const px = innerWidth * devicePixelRatio, rung = (l: [number, string][]) => (l.find(([w]) => w >= px) ?? l[l.length - 1])[1];

  const name = document.createElement("div");
  name.className = "jg-split-name";
    const [a, b] = ["Julian", "Gigola"].map((w) => {
    const s = document.createElement("span");
    s.textContent = w;
    name.append(s);
    return s;
  });
  const win = document.createElement("div");
  win.className = "jg-split-win";
  /* The hero, laid exactly over the cover's own photograph and clipped to
     the window, so opening the window is the page appearing. */
  const hero = document.createElement("img");
  hero.className = "jg-split-hero";
  hero.alt = "";
  hero.src = root.dataset.theme === "light" ? rung(heroes.l) : rung(heroes.d);
  layer.append(win, hero, name);

  const ready = new Set<HTMLImageElement>();
  hero.decode().then(() => ready.add(hero), () => {});
  const pics = sizes.map((f) => {
    const i = document.createElement("img");
    i.alt = "";
    i.fetchPriority = "high";
    i.src = f[0]; // the window is small: the phone copy is plenty
    i.decode().then(() => ready.add(i), () => {});
    win.append(i);
    return i;
  });

  (async () => {
    const start = performance.now();
    /* The cover's name sets the type, so the words land at their own size.
       This runs as the document is read, before the cover is in it, so it
       waits for the name and its stylesheet (a bare h1 is 2em, 32px). */
    let h1: HTMLElement | null = null;
    for (; performance.now() - start < 1500; await sleep(20)) {
      h1 = document.querySelector<HTMLElement>(".a-cover h1");
      if (h1 && parseFloat(getComputedStyle(h1).fontSize) > 40) break;
    }
    const cs = h1 ? getComputedStyle(h1) : null;
    /* On a narrow screen the parted name would run off the sides, so it
       starts smaller and grows to the cover's size as it lands. */
    const size = cs ? parseFloat(cs.fontSize) : 64;
    name.style.fontSize = `${size}px`;
    if (cs) name.style.fontFamily = cs.fontFamily;
    const fit = Math.min(1, (innerWidth * 0.92) / (name.offsetWidth * 1.35));
    name.style.fontSize = `${size * fit}px`;
    /* Each word's text box, measured before anything moves: the landing
       scales it about its own top-left corner onto the cover's name. */
    const textBox = (n: Text, s: number, e: number) => {
      const g = document.createRange();
      g.setStart(n, s);
      g.setEnd(n, e);
      return g.getBoundingClientRect();
    };
    const fromBox = [a, b].map((k) => {
      const t = textBox(k.firstChild as Text, 0, 6), sp = k.getBoundingClientRect();
      k.style.transformOrigin = `${t.left - sp.left}px ${t.top - sp.top}px`;
      return t;
    });
    name.animate([{ opacity: 0 }, { opacity: 1 }], { duration: UP, easing: OUT, fill: "forwards" });
    await sleep(UP);
    while (ready.size < pics.length + 1 && performance.now() - start < WAIT) await sleep(30);
    const run = pics.filter((p) => ready.has(p));

    /* The window in the gap, 4:5, as tall as the type's caps and a little
       over; each word moves out by half of it, so they nearly touch it. */
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const h = ra.height * 0.95, w = h * 0.8, half = (w - (rb.left - ra.right)) / 2 + h * 0.06;
    const wx = (ra.right + rb.left) / 2 - w / 2, wy = ra.top + (ra.height - h) / 2;
    Object.assign(win.style, { left: `${wx}px`, top: `${wy}px`, width: `${w}px`, height: `${h}px` });
    const part = (k: HTMLElement, dx: number, d: number) =>
      k.animate([{ transform: "none" }, { transform: `translateX(${dx}px)` }], { duration: d, easing: MOVE, fill: "forwards" });
    if (run[0]) run[0].style.opacity = "1";
    part(a, -half, PART);
    part(b, half, PART);
    win.animate([{ clipPath: "inset(0 50%)" }, { clipPath: "inset(0 0%)" }], { duration: PART, easing: MOVE, fill: "forwards" });
    await sleep(PART);
    for (let k = 1; k < run.length; k++) {
      await sleep(BEAT);
      run[k - 1].style.opacity = "0";
      run[k].style.opacity = "1";
    }
    await sleep(BEAT);

    /* The hero over the cover's photograph, cut to the window. */
    const real = [...document.querySelectorAll<HTMLImageElement>(".a-cover .slides img.on")].find((i) => i.offsetWidth > 0);
    const r = (real ?? document.querySelector(".a-cover .slides"))?.getBoundingClientRect();
    const land = (fn: () => void) => {
      root.dataset.landed = "";
      root.dataset.landing = "";
      root.dataset.intro = "half";
      root.dataset.splashed = "";
      document.getElementById("jg-intro")?.classList.add("jg-intro-open");
      fn();
    };
    if (!r || !h1 || !ready.has(hero)) {
      // nothing to land on: the name lifts away and the page comes up
      land(() => layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: OUT, fill: "forwards" }));
      await sleep(400);
      root.removeAttribute("data-intro");
      return;
    }
    /* The hero takes the window's place, then its box grows into the
       cover's (on a phone the cover's photograph sits above the window, so
       a crop of it would show nothing). `cover` keeps it filled all the way. */
    const box = (x: number, y: number, bw: number, bh: number) => ({ left: `${x}px`, top: `${y}px`, width: `${bw}px`, height: `${bh}px` });
    Object.assign(hero.style, box(wx, wy, w, h), { objectPosition: real ? getComputedStyle(real).objectPosition : "50% 50%", opacity: "1" });
    for (const p of run) p.style.opacity = "0";
    await sleep(HOLD);

    /* Where each word sits in the cover's name, read off its own text. */
    const t = h1.firstChild as Text, to = [textBox(t, 0, 6), textBox(t, 7, 13)];
    [a, b].forEach((k, i) => {
      const dx = to[i].left - fromBox[i].left, dy = to[i].top - fromBox[i].top;
      k.animate([{ transform: `translateX(${i ? half : -half}px)` }, { transform: `translate(${dx}px, ${dy}px) scale(${to[i].height / fromBox[i].height})` }],
        { duration: OPEN, easing: MOVE, fill: "forwards" });
    });
    // shortcut: animates the box (layout) on one fixed element for 1s; move to transform + clip if a phone drops frames
    hero.animate([box(wx, wy, w, h), box(r.left, r.top, r.width, r.height)], { duration: OPEN, easing: MOVE, fill: "forwards" });
    await sleep(OPEN);

    /* The splash now shows exactly the page: hand over and step aside. */
    land(() => (layer.style.visibility = "hidden"));
    await sleep(60);
    root.removeAttribute("data-intro");
    await sleep(1500);
    delete root.dataset.landing;
    delete root.dataset.landed;
  })();
}
