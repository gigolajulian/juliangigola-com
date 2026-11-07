/* ── `?splash=split`: J and G round a window of frames, opening into the page ──
 * Julian's reference (2026-11-07, "Video Project 4.mp4", a MONO studio
 * opener): letters part round a window and the run cuts fast inside it.
 * Round two ("too small", "not seamless"): the window's last frame is the
 * hero, which grows into the cover's photograph. Round three ("do J and G
 * then transition to hero fill out Julian Gigola"): the opening is the
 * monogram, J and G as tall as the window; as the hero opens they glide
 * onto their places in the cover's name and the rest of the letters rise
 * in round them, each where the page has it. Nothing is swapped or faded
 * at the hand-over. Preview only, behind the flag.
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

  const UP = 500; // the monogram coming up from dim
  const PART = 520; // J and G parting, the window opening
  const BEAT = 120; // one frame in the window
  const HOLD = 260; // the hero in the window before it opens
  const OPEN = 1000; // the hero growing into the cover, J and G landing
  const FILL = 520; // one letter of the rest rising into its place
  const STAGGER = 28; // between those letters, outward from J and from G
  const WAIT = 2500; // the longest the monogram waits for the frames
  const OUT = "cubic-bezier(0.23, 1, 0.32, 1)"; // `--ease-out`, tokens.css
  const MOVE = "cubic-bezier(0.77, 0, 0.175, 1)"; // `--ease-move`
  const LAND = "cubic-bezier(0.2, 0.7, 0.2, 1)"; // the page's own rise (`--land`, splash.css)
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const px = innerWidth * devicePixelRatio, rung = (l: [number, string][]) => (l.find(([w]) => w >= px) ?? l[l.length - 1])[1];

  const win = document.createElement("div");
  win.className = "jg-split-win";
  const hero = document.createElement("img");
  hero.className = "jg-split-hero";
  hero.alt = "";
  hero.src = root.dataset.theme === "light" ? rung(heroes.l) : rung(heroes.d);
  layer.append(win, hero);

  const ready = new Set<HTMLImageElement>();
  hero.decode().then(() => ready.add(hero), () => {});
  const pics = sizes.map((f) => {
    const i = document.createElement("img");
    i.alt = "";
    i.fetchPriority = "high";
    i.src = f[0];
    i.decode().then(() => ready.add(i), () => {});
    win.append(i);
    return i;
  });

  const land = () => {
    root.dataset.landed = "";
    root.dataset.landing = "";
    root.dataset.intro = "half";
    root.dataset.splashed = "";
    document.getElementById("jg-intro")?.classList.add("jg-intro-open");
  };

  (async () => {
    const start = performance.now();
    /* The cover's name places every letter. This runs as the document is
       read, before the cover is in it, so it waits for the name and its
       stylesheet (a bare h1 is 2em, 32px). */
    let h1: HTMLElement | null = null;
    for (; performance.now() - start < 1500; await sleep(20)) {
      h1 = document.querySelector<HTMLElement>(".a-cover h1");
      if (h1 && parseFloat(getComputedStyle(h1).fontSize) > 40) break;
    }
    const text = h1?.firstChild;
    if (!h1 || !(text instanceof Text) || text.data !== "Julian Gigola") {
      // no name to land on: the page simply comes up
      land();
      layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: OUT, fill: "forwards" });
      await sleep(400);
      root.removeAttribute("data-intro");
      return;
    }

    /* Every letter in a mask of its own box, so the rest can rise out of
       their line. Their places in the cover's name are read only at the
       hand-over: before that the cover may not be laid out yet. */
    const cs = getComputedStyle(h1);
    const chars = [...text.data].map((ch, i) => {
      const mask = document.createElement("span");
      mask.className = "jg-split-ch";
      Object.assign(mask.style, { font: cs.font, lineHeight: "normal" });
      const l = document.createElement("span");
      l.textContent = ch;
      mask.append(l);
      if (ch !== " ") layer.append(mask);
      return { i, mask, l };
    }).filter((c) => c.l.textContent !== " ");
    const J = chars[0], G = chars[6];
    const rest = chars.filter((c) => c !== J && c !== G);
    for (const c of rest) Object.assign(c.l.style, { transform: "translateY(105%)" }), (c.mask.style.visibility = "hidden");
    J.mask.style.overflow = G.mask.style.overflow = "visible";
    const jb = J.mask.getBoundingClientRect(), gb = G.mask.getBoundingClientRect();

    /* The window: on a phone 40% of the screen's width, wider screens 42%
       of its height, at 4:5, in the middle. J and G as tall as it. */
    const phone = innerWidth < 700;
    const h = phone ? innerWidth * 0.5 : innerHeight * 0.42, w = h * 0.8;
    const wx = (innerWidth - w) / 2, wy = (innerHeight - h) / 2;
    Object.assign(win.style, { left: `${wx}px`, top: `${wy}px`, width: `${w}px`, height: `${h}px` });
    // as tall as the window, unless that runs off a narrow screen
    const gap = h * 0.04, s = Math.min(h / jb.height, (innerWidth * 0.94 - w - 2 * gap) / (jb.width + gb.width));
    const ly = wy + (h - jb.height * s) / 2;
    // J and G sit at the top-left of the screen until the hand-over, moved from there
    const at = (x: number, ox = 0, oy = 0) => `translate(${x - ox}px, ${ly - oy}px) scale(${s})`;
    const jClosed = innerWidth / 2 - gap / 2 - jb.width * s, gClosed = innerWidth / 2 + gap / 2;
    const jOpen = wx - gap - jb.width * s, gOpen = wx + w + gap;
    J.mask.style.transformOrigin = G.mask.style.transformOrigin = "0 0";
    J.mask.style.transform = at(jClosed);
    G.mask.style.transform = at(gClosed);

    for (const c of [J, G]) c.mask.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: UP, easing: OUT, fill: "forwards" });
    await sleep(UP);
    while (ready.size < pics.length + 1 && performance.now() - start < WAIT) await sleep(30);
    const run = pics.filter((p) => ready.has(p));

    if (run[0]) run[0].style.opacity = "1";
    J.mask.animate([{ transform: at(jClosed) }, { transform: at(jOpen) }], { duration: PART, easing: MOVE, fill: "forwards" });
    G.mask.animate([{ transform: at(gClosed) }, { transform: at(gOpen) }], { duration: PART, easing: MOVE, fill: "forwards" });
    win.animate([{ clipPath: "inset(0 50%)" }, { clipPath: "inset(0 0%)" }], { duration: PART, easing: MOVE, fill: "forwards" });
    await sleep(PART);
    for (let k = 1; k < run.length; k++) {
      await sleep(BEAT);
      run[k - 1].style.opacity = "0";
      run[k].style.opacity = "1";
    }
    await sleep(BEAT);

    /* The hero takes the window's place, then its box grows into the
       cover's photograph, `cover` keeping it filled all the way. */
    const real = [...document.querySelectorAll<HTMLImageElement>(".a-cover .slides img.on")].find((i) => i.offsetWidth > 0);
    const r = (real ?? document.querySelector(".a-cover .slides"))?.getBoundingClientRect();
    const rect = (x: number, y: number, bw: number, bh: number) => ({ left: `${x}px`, top: `${y}px`, width: `${bw}px`, height: `${bh}px` });
    if (r && ready.has(hero)) {
      Object.assign(hero.style, rect(wx, wy, w, h), { objectPosition: real ? getComputedStyle(real).objectPosition : "50% 50%", opacity: "1" });
      for (const p of run) p.style.opacity = "0";
      await sleep(HOLD);
      // shortcut: animates the box (layout) on one fixed element for 1s; move to transform + clip if a phone drops frames
      hero.animate([rect(wx, wy, w, h), rect(r.left, r.top, r.width, r.height)], { duration: OPEN, easing: MOVE, fill: "forwards" });
    } else {
      win.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OPEN / 2, easing: OUT, fill: "forwards" });
    }
    /* Now every letter takes its box in the cover's name; J and G glide
       there from where they are. */
    const place = (c: (typeof chars)[number]) => {
      const g = document.createRange();
      g.setStart(text, c.i);
      g.setEnd(text, c.i + 1);
      const b = g.getBoundingClientRect();
      Object.assign(c.mask.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px`, visibility: "visible" });
      return b;
    };
    for (const c of rest) place(c);
    const jt = place(J), gt = place(G);
    J.mask.animate([{ transform: at(jOpen, jt.left, jt.top) }, { transform: "none" }], { duration: OPEN, easing: MOVE, fill: "forwards" });
    G.mask.animate([{ transform: at(gOpen, gt.left, gt.top) }, { transform: "none" }], { duration: OPEN, easing: MOVE, fill: "forwards" });
    /* The rest fill out once J and G are most of the way home, outward
       from each capital, as the hero settles. */
    rest.forEach((c) => {
      const n = c.i < 6 ? c.i : c.i - 7;
      c.l.animate([{ transform: "translateY(105%)" }, { transform: "none" }],
        { duration: FILL, delay: OPEN * 0.5 + (n - 1) * STAGGER, easing: LAND, fill: "forwards" });
    });
    await sleep(Math.max(OPEN, OPEN * 0.5 + 4 * STAGGER + FILL));

    /* The splash now shows exactly the page: hand over and step aside. */
    land();
    layer.style.visibility = "hidden";
    await sleep(60);
    root.removeAttribute("data-intro");
    await sleep(1500);
    delete root.dataset.landing;
    delete root.dataset.landed;
  })();
}
