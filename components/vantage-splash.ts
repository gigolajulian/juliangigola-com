/* ── `?splash=vantage`: two vantages on one cut, then the hero ────────
 * Julian's pick (2026-11-02, after Slate): the screen split on a
 * diagonal, a frame shot from above on one side and a frame shot from
 * below on the other, sliding past each other along the cut; the credit
 * set in the gutter between them; then a hard cut to the page.
 *
 *   High: Prowess Unleashed 01, looking down on a figure in a swirl.
 *   Low: Aegis 01, looking up into a chainmail hood.
 *
 * The cut runs low left to high right (18° on a wide screen, 28° on a
 * tall one). Each frame comes in along it from its own end and keeps
 * drifting, the high one down the cut and the low one up it, like two
 * dollies passing. The gutter holds the credit in mono on the same angle.
 * Then the edit cuts: the layer goes in one frame and the page is there,
 * the cover's name, nav and buttons coming in as after the burst
 * (`data-landing`, `data-landed`, splash.css).
 *
 * Homepage only (other pages get the name alone, `layout.tsx`); reduced
 * motion gets no opening. Written into the page as source and run as the
 * document is read, like the burst; if the two frames have not come in
 * time it skips straight to the page.
 * ─────────────────────────────────────────────────────────────── */
export function vantage(frames: { hi: [number, string][]; lo: [number, string][] }) {
  const root = document.documentElement;
  if (root.dataset.splash !== "vantage" || root.dataset.intro !== "1") return;
  const layer = document.querySelector("#jg-intro .jg-sheet-wrap");
  if (!layer) return;
  const phone = innerWidth < 700;
  const px = innerWidth * devicePixelRatio, rung = (l: [number, string][]) => (l.find(([w]) => w >= px) ?? l[l.length - 1])[1];

  const ENTER = phone ? 640 : 760; // each frame sliding in along the cut
  const DRIFT = phone ? 900 : 1100; // and carrying on past the other
  const LOAD = 2500; // the longest the ground waits for the two frames
  const HERO = 1500; // and then for the page's own hero, before cutting anyway
  const ANGLE = ((phone ? 28 : 18) * Math.PI) / 180;
  const GUTTER = phone ? 26 : 34;
  const DOLLY = "cubic-bezier(0.65, 0, 0.35, 1)";
  const OUT = "cubic-bezier(0.2, 0.7, 0.2, 1)";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const vw = innerWidth, vh = innerHeight, cx = vw / 2, cy = vh / 2, L = Math.hypot(vw, vh);
  const dx = Math.cos(ANGLE), dy = -Math.sin(ANGLE), nx = Math.sin(ANGLE), ny = Math.cos(ANGLE);
  /* One side of the cut, its edge held half a gutter off the line. */
  const side = (s: number) => `polygon(${[[-1, GUTTER / 2], [1, GUTTER / 2], [1, L], [-1, L]]
    .map(([u, t]) => `${cx + dx * L * u + nx * t * s}px ${cy + dy * L * u + ny * t * s}px`).join(", ")})`;

  /* Each photograph is framed for its own side of the cut: the box slides
     so the subject lands on that side, not under the other frame. The low
     vantage has its face high in the frame (Aegis, looking up), so its box
     starts at the cut's highest point and crops from the top. */
  const rise = (vw / 2) * Math.tan(ANGLE); // how far the cut climbs from the middle to the right edge
  const panel = (src: string, s: number, top: number, at: string) => {
    const p = document.createElement("div");
    p.className = "jg-vant";
    p.style.clipPath = side(s);
    const i = document.createElement("img");
    i.alt = "";
    i.fetchPriority = "high";
    i.src = src;
    Object.assign(i.style, { top: `${top}px`, height: `${vh}px`, objectPosition: at });
    p.append(i);
    return { p, i, ok: i.decode().then(() => true, () => false) };
  };
  // above the cut; on a wide screen the photograph is cropped top and bottom, so it is held toward its face
  const hi = panel(rung(frames.hi), -1, phone ? -vh * 0.1 : 0, phone ? "50% 50%" : "50% 24%");
  const lo = panel(rung(frames.lo), 1, Math.max(0, cy - rise - GUTTER), "50% 14%"); // below it

  /* The credit, laid along the gutter. A phone has room for two parts. */
  const credit = document.createElement("div");
  credit.className = "jg-vant-credit";
  const parts = phone ? ["Julian Gigola", "Photo / AD / Director"] : ["Julian Gigola", "Photo / AD / Director", "San Francisco Bay Area"];
  parts.forEach((t, k) => {
    if (k) { const dot = document.createElement("b"); dot.textContent = "·"; credit.append(dot); }
    const s = document.createElement("span");
    s.textContent = t;
    credit.append(s);
  });
  credit.style.transform = `translate(-50%, -50%) rotate(${-ANGLE}rad)`;
  layer.append(hi.p, lo.p, credit);

  const real = () => [...document.querySelectorAll<HTMLImageElement>(".a-cover .slides img.on")].find((i) => i.offsetWidth > 0);
  const landed = () => { const h = real(); return !!h && h.complete && h.naturalWidth > 0; };

  (async () => {
    // the clock starts at the first frame drawn (`#jg-sized` holds the paint, layout.tsx)
    await new Promise((r) => requestAnimationFrame(r));
    const start = performance.now();
    let ready = false;
    Promise.all([hi.ok, lo.ok]).then(([a, b]) => (ready = a && b));
    while (!ready && performance.now() - start < LOAD) await sleep(30);

    if (ready) {
      /* In along the cut from opposite ends, then on past each other. One
         path per frame, so entering and drifting are one move. */
      const far = Math.min(vw, vh) * 0.32, on = Math.min(vw, vh) * 0.06;
      const along = (k: number) => `translate(${dx * k}px, ${dy * k}px) scale(1.14)`;
      const total = ENTER + DRIFT, mid = ENTER / total;
      hi.i.animate([{ transform: along(-far), opacity: 0 }, { opacity: 1, offset: mid * 0.5 }, { transform: along(0), offset: mid, easing: "linear" }, { transform: along(on), opacity: 1 }],
        { duration: total, easing: OUT, fill: "forwards" });
      lo.i.animate([{ transform: along(far), opacity: 0 }, { opacity: 1, offset: mid * 0.5 }, { transform: along(0), offset: mid, easing: "linear" }, { transform: along(-on), opacity: 1 }],
        { duration: total, easing: OUT, fill: "forwards" });
      credit.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: ENTER * 0.6, easing: DOLLY, fill: "forwards" });
      await sleep(total);
      const wait = performance.now();
      while (!landed() && performance.now() - wait < HERO) await sleep(30);
    }

    /* The cut: everything goes in one frame and the page is there. */
    root.dataset.landing = "";
    root.dataset.landed = "";
    root.dataset.intro = "half";
    root.dataset.splashed = "";
    document.getElementById("jg-intro")?.classList.add("jg-intro-open");
    (layer as HTMLElement).style.visibility = "hidden";
    root.removeAttribute("data-intro");
    await sleep(1500); // the cover's name, buttons and nav finishing their moves
    delete root.dataset.landing;
    delete root.dataset.landed;
  })();
}
