/* ── `?splash=slate`: a slate, a shutter, the opening shot ────────────
 * Julian's pick (2026-11-02, from three directions): a film slate on the
 * page's ground (near-black in dark), then one diagonal cut to the hero.
 *
 *   Slate. Four lines of the credit in mono at the top left (the right on
 *   a phone, clear of the notch), each rising out of its own line. The
 *   take number is the loader and the screen's one accent: 01 while the
 *   photograph comes, 02 once the splash has it, 03 once the page's own
 *   copy has landed too, and it holds there until it has.
 *   Shutter. A hairline opens across the black on a diagonal, low left to
 *   high right, like a blade, and widens until the photograph fills the
 *   screen, cropped tighter and off its axis.
 *   Settle. One slow move, like a dolly, from that crop to the hero's own
 *   frame on the page. The slate has cleared with the blade, the ground thins
 *   round it, and the cover's name, nav and buttons come in as the burst's
 *   do (`data-landing`, `data-landed`, splash.css).
 *
 * Homepage only (the head script in `layout.tsx` gives other pages the
 * name alone). Reduced motion never gets an opening at all. Like the burst
 * it is written into the page as source and run as the document is read,
 * so it touches nothing but the browser and its argument; a photograph
 * that has not come by `MAX` is skipped and the page simply comes up.
 * ─────────────────────────────────────────────────────────────── */
export function slate(heroes: { d: [number, string][]; l: [number, string][] }) {
  const root = document.documentElement;
  if (root.dataset.splash !== "slate" || root.dataset.intro !== "1") return;
  const layer = document.querySelector("#jg-intro .jg-sheet-wrap");
  if (!layer) return;
  const phone = innerWidth < 700;
  const px = innerWidth * devicePixelRatio, rung = (l: [number, string][]) => (l.find(([w]) => w >= px) ?? l[l.length - 1])[1];

  const RISE = 420; // one slate line rising out of its line
  const STAGGER = phone ? 80 : 110;
  const HOLD = 260; // the slate whole, at its last take
  const LOAD = 3000; // the longest the slate waits for the photograph
  const SHUTTER = phone ? 560 : 700;
  const SETTLE = phone ? 720 : 900;
  const CLEAR = 220; // the splash's copy giving way to the page's own
  const MAX = 5500;
  const ANGLE = ((phone ? 28 : 18) * Math.PI) / 180; // steeper on a tall screen
  const ZOOM = 1.12; // the opening crop, tighter than the hero's
  const AT = [0.32, 0.38]; // and off its axis
  const BLADE = "cubic-bezier(0.7, 0, 0.2, 1)";
  const DOLLY = "cubic-bezier(0.65, 0, 0.35, 1)";
  const OUT = "cubic-bezier(0.2, 0.7, 0.2, 1)";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const card = document.createElement("div");
  card.className = "jg-slate";
  const take = document.createElement("b");
  take.textContent = "01";
  const lines: HTMLElement[] = [];
  for (const t of ["Julian Gigola", "Photo / AD / Director", "San Francisco Bay Area", "Take "]) {
    const line = document.createElement("span");
    const inner = document.createElement("span");
    inner.textContent = t;
    if (t === "Take ") inner.append(take);
    line.append(inner);
    card.append(line);
    lines.push(inner);
  }
  card.setAttribute("aria-label", "Julian Gigola. Photo, AD, Director. San Francisco Bay Area.");

  const shot = document.createElement("img");
  shot.className = "jg-slate-shot";
  shot.alt = "";
  shot.fetchPriority = "high";
  shot.src = root.dataset.theme === "light" ? rung(heroes.l) : rung(heroes.d);
  let ready = false;
  shot.decode().then(() => (ready = true), () => {});
  layer.append(shot, card);

  // the shown one of the cover's pair (v3d or v3l, by theme)
  const real = () => [...document.querySelectorAll<HTMLImageElement>(".a-cover .slides img.on")].find((i) => i.offsetWidth > 0);
  const landed = () => { const h = real(); return !!h && h.complete && h.naturalWidth > 0; };
  const count = () => (take.textContent = landed() && ready ? "03" : ready ? "02" : "01");

  (async () => {
    /* The clock starts at the first frame drawn, not when this runs: the
       page is held from painting until its sizes are in (`#jg-sized`,
       layout.tsx), and on a slow connection that ate the whole budget, so
       the slate showed and went straight to the page (iPhone simulator). */
    await new Promise((r) => requestAnimationFrame(r));
    const start = performance.now(), left = () => start + MAX - performance.now();
    lines.forEach((l, i) =>
      l.animate([{ transform: "translateY(110%)" }, { transform: "none" }], { duration: RISE, delay: i * STAGGER, easing: OUT, fill: "forwards" }));
    await sleep(RISE + (lines.length - 1) * STAGGER);
    while (!(ready && landed()) && performance.now() - start < LOAD) { count(); await sleep(40); }
    count();
    await sleep(HOLD);

    const ground = layer.querySelector(".jg-sheet-ground");
    const finish = async () => {
      root.dataset.landed = ""; // the cover's type comes in now the photograph is in place (splash.css)
      root.dataset.intro = "half";
      root.dataset.splashed = "";
      document.getElementById("jg-intro")?.classList.add("jg-intro-open");
      for (const el of [shot, card, ground]) el?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLEAR, easing: DOLLY, fill: "forwards" });
      await sleep(CLEAR);
      root.removeAttribute("data-intro");
      await sleep(1500); // the cover's name, buttons and nav finishing their moves
      delete root.dataset.landing;
      delete root.dataset.landed;
    };
    const h = real(), r = h?.getBoundingClientRect();
    /* No photograph in time, or nowhere to land it: the page comes up. */
    if (!ready || !r || r.width === 0 || left() < SHUTTER + SETTLE + CLEAR) {
      root.dataset.landing = "";
      return finish();
    }

    /* The photograph's box never moves (no layout shift): it is laid out
       once as the opening crop, and the settle is transform and clip-path
       on it, sampled so the crop follows the box exactly. */
    const vw = innerWidth, vh = innerHeight, a = shot.naturalWidth / shot.naturalHeight;
    const cover = (x: number, y: number, w: number, ht: number, z: number, ax: number, ay: number) => {
      const dw = Math.max(w, ht * a) * z, dh = dw / a;
      return { l: x + (w - dw) * ax, t: y + (ht - dh) * ay, w: dw, h: dh };
    };
    const base = cover(0, 0, vw, vh, ZOOM, AT[0], AT[1]);
    Object.assign(shot.style, { left: `${base.l}px`, top: `${base.t}px`, width: `${base.w}px`, height: `${base.h}px`, transformOrigin: "0 0" });

    /* The blade: a band along the diagonal through the screen's middle,
       from a hairline to wider than the screen. Drawn in the box's own
       coordinates, which are the screen's offset by its corner. */
    const cx = vw / 2 - base.l, cy = vh / 2 - base.t, L = Math.hypot(vw, vh);
    const dx = Math.cos(ANGLE), dy = -Math.sin(ANGLE), nx = Math.sin(ANGLE), ny = Math.cos(ANGLE);
    const band = (t: number) => `polygon(${[[-1, -1], [1, -1], [1, 1], [-1, 1]]
      .map(([u, s]) => `${cx + dx * L * u + nx * t * s}px ${cy + dy * L * u + ny * t * s}px`).join(", ")})`;
    shot.style.clipPath = band(0.5);
    shot.style.opacity = "1";
    // the slate clears as the blade widens, never over the photograph
    card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SHUTTER * 0.45, delay: SHUTTER * 0.2, easing: DOLLY, fill: "forwards" });
    await shot.animate([{ clipPath: band(0.5) }, { clipPath: band(L / 2 + 2) }], { duration: SHUTTER, easing: BLADE, fill: "forwards" }).finished;

    /* The dolly: from the opening crop on the whole screen to the hero's
       box, crop and object-position. */
    const pos = getComputedStyle(h!).objectPosition.split(" ");
    const frac = (v = "50%", room: number) => (v.endsWith("%") ? parseFloat(v) / 100 : room ? parseFloat(v) / room : 0.5);
    const end = cover(r.left, r.top, r.width, r.height, 1, 0, 0);
    const ex = frac(pos[0], r.width - end.w), ey = frac(pos[1], r.height - end.h);
    const lerp = (x: number, y: number, p: number) => x + (y - x) * p;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= 24; i++) {
      const p = i / 24;
      const bx = lerp(0, r.left, p), by = lerp(0, r.top, p), bw = lerp(vw, r.width, p), bh = lerp(vh, r.height, p);
      const c = cover(bx, by, bw, bh, lerp(ZOOM, 1, p), lerp(AT[0], ex, p), lerp(AT[1], ey, p));
      const k = c.w / base.w;
      const T = (by - c.t) / k, Lf = (bx - c.l) / k;
      frames.push({
        transform: `translate(${c.l - base.l}px, ${c.t - base.t}px) scale(${k})`,
        clipPath: `inset(${T}px ${base.w - Lf - bw / k}px ${base.h - T - bh / k}px ${Lf}px)`,
      });
    }
    root.dataset.landing = "";
    ground?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SETTLE * 0.5, delay: SETTLE * 0.5, easing: DOLLY, fill: "forwards" });
    await shot.animate(frames, { duration: SETTLE, easing: DOLLY, fill: "forwards" }).finished;
    return finish();
  })();
}
