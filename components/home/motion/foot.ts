import { clamp, smooth, progressBetween, type Ctx, type Driver } from "./engine";

/* Footer, spec 3.10: the still's reveal, phrase drift, dot pointer and hover
   spot. The wall is one still (foot.tsx), so the column drift, the frame lift
   and open, and the phone row are gone. Numbers are design units (1440x900)
   unless a name says px. */
const R = 510; // spot radius
const mod = (v: number, m: number) => ((v % m) + m) % m;
const MS = 1000;

type Buf = readonly [HTMLCanvasElement, CanvasRenderingContext2D];

/** Everything setup() keeps between frames: the nodes it found and made, and the drift, dot and spot state. */
type Foot = {
  el: HTMLElement;
  stage: HTMLElement;
  wall: HTMLElement;
  btn: HTMLElement;
  row: HTMLElement;
  mt: HTMLElement | null;
  cut: HTMLCanvasElement;
  dot: HTMLElement;
  g: CanvasRenderingContext2D;
  bufs: { wash: Buf; blur: Buf; sharp: Buf; mask: Buf };
  clones: Node[];
  // the still's reveal
  reveal: number;
  dirty: boolean;
  // pointer, client px
  px: number;
  py: number;
  // phrase
  phraseW: number;
  pad: number;
  phraseX: number;
  phraseV: number;
  kick: number;
  rowX: number;
  first: boolean;
  // dot and spot
  hot: boolean;
  dotX: number;
  dotY: number;
  dotAlpha: number;
  spotX: number;
  spotY: number;
  spotAlpha: number;
  spotOut: string;
  ink: string;
  phraseMask: HTMLCanvasElement | null;
  maskZoom: number;
};

function make<K extends keyof HTMLElementTagNameMap>(stage: HTMLElement, tag: K, cls: string) {
  const n = document.createElement(tag);
  n.className = cls;
  n.setAttribute("aria-hidden", "true");
  return stage.appendChild(n);
}

function buf(): Buf {
  const c = document.createElement("canvas");
  return [c, c.getContext("2d")!] as const;
}

function measure(f: Foot, ctx: Ctx) {
  const { row } = f;
  f.phraseW = (row.firstElementChild as HTMLElement).getBoundingClientRect().width;
  f.pad = parseFloat(getComputedStyle(row).paddingLeft) || 0;
  // ultrawide: three copies do not span the loop, add more
  for (let n = row.children.length; f.phraseW > 0 && (n - 1) * f.phraseW < ctx.vw; n++) {
    const last = row.lastElementChild;
    if (!last) break;
    f.clones.push(row.appendChild(last.cloneNode(true)));
  }
  // start with a copy at the resting position and one already off to its left
  if (f.first && f.phraseW) {
    f.phraseX = -f.pad;
    f.first = false;
  }
  f.phraseMask = null;
}

/* One phrase as a mask. Drawn at 280px or less with no canvas scale: above
   about 300px fillText punches the variable font's overlaps out as holes. */
function mask(f: Foot, br: DOMRect) {
  const ph = f.row.firstElementChild as HTMLElement,
    cs = getComputedStyle(ph),
    fs = parseFloat(cs.fontSize),
    pr = ph.getBoundingClientRect();
  const zoom = (f.maskZoom = Math.min(1, 280 / fs));
  const [c, k] = buf();
  c.width = Math.ceil(f.phraseW * zoom);
  c.height = Math.ceil(br.height * zoom);
  const probe = document.createElement("b");
  probe.style.cssText = "display:inline-block;width:0;height:0";
  (ph.firstElementChild ?? ph).appendChild(probe);
  const base = (probe.getBoundingClientRect().top - br.top) * zoom;
  probe.remove();
  k.font = `${cs.fontWeight} ${fs * zoom}px ${cs.fontFamily}`;
  k.fillStyle = k.strokeStyle = "#fff";
  // a hair wider than the letters, or their grey edge shows around the photo
  k.lineWidth = 1.5 * zoom;
  k.lineJoin = "round";
  for (const l of ph.children) {
    const lx = (l.getBoundingClientRect().left - pr.left) * zoom;
    k.fillText(l.textContent ?? "", lx, base);
    k.strokeText(l.textContent ?? "", lx, base);
  }
  return c;
}

function fit(c: HTMLCanvasElement, cw: number, ch: number) {
  if (c.width !== cw || c.height !== ch) {
    c.width = cw;
    c.height = ch;
  }
}

function grad(k: CanvasRenderingContext2D, gx: number, gy: number, r0: number, r1: number, at: number, a: number) {
  const gr = k.createRadialGradient(gx, gy, r0, gx, gy, r1);
  gr.addColorStop(0, "rgba(0,0,0,1)");
  gr.addColorStop(at, `rgba(0,0,0,${a})`);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  return gr;
}

/* The spot: the letters rest lit (foot.css) and go back to the plain grey
   near the dot. The canvas is only the
   spot's box inside the phrase band. */
function draw(f: Foot, r: DOMRect, u: number) {
  const { btn, cut, g, row } = f;
  const [washC, wash] = f.bufs.wash,
    [blurC, blur] = f.bufs.blur,
    [sharpC, sharp] = f.bufs.sharp,
    [maskC, maskCtx] = f.bufs.mask;
  const br = btn.getBoundingClientRect();
  if (!f.phraseMask && f.phraseW && document.fonts.status === "loaded") f.phraseMask = mask(f, br);
  const phraseMask = f.phraseMask;
  if (!phraseMask) return;
  const dpr = Math.min(2, devicePixelRatio || 1),
    Ru = R * u,
    bw = 2 * Ru,
    bh = br.height;
  const snap = (n: number) => Math.round(n * dpr) / dpr;
  const ox = snap(f.spotX - Ru),
    oy = snap(br.top - r.top);
  const cw = Math.round(bw * dpr),
    ch = Math.round(bh * dpr);
  if (cut.width !== cw || cut.height !== ch) {
    cut.style.width = `${bw}px`;
    cut.style.height = `${bh}px`;
  }
  fit(cut, cw, ch);
  fit(washC, cw, ch);
  fit(sharpC, cw, ch);
  fit(maskC, cw, ch);
  fit(blurC, Math.ceil(cw / 6), Math.ceil(ch / 6));
  cut.style.transform = `translate3d(${ox}px,${oy}px,0)`;

  // the resting grey over the lit letters, at full strength (the falloff is in the gradients below)
  wash.setTransform(dpr, 0, 0, dpr, 0, 0);
  wash.fillStyle = f.ink;
  wash.fillRect(0, 0, bw, bh);

  const gx = (f.spotX - ox) * dpr,
    gy = (f.spotY - oy) * dpr,
    ud = u * dpr;
  // blur without ctx.filter (Safari): down to 1/6 and back up
  blur.imageSmoothingQuality = "high";
  blur.globalCompositeOperation = "copy";
  blur.drawImage(washC, 0, 0, blurC.width, blurC.height);
  sharp.globalCompositeOperation = "copy";
  sharp.drawImage(washC, 0, 0);
  sharp.globalCompositeOperation = "destination-in";
  sharp.fillStyle = grad(sharp, gx, gy, 40 * ud, 300 * ud, 0.35, 0.85);
  sharp.fillRect(0, 0, cw, ch);
  g.imageSmoothingQuality = "high";
  g.globalCompositeOperation = "copy";
  g.drawImage(blurC, 0, 0, cw, ch);
  g.globalCompositeOperation = "source-over";
  g.drawImage(sharpC, 0, 0);

  // letters in view, times the spot falloff
  maskCtx.globalCompositeOperation = "source-over";
  maskCtx.clearRect(0, 0, cw, ch);
  const left = br.left - r.left + f.pad + f.rowX - ox,
    mw = (phraseMask.width / f.maskZoom) * dpr,
    mh = (phraseMask.height / f.maskZoom) * dpr;
  for (let i = 0; i < row.children.length; i++) {
    const lx = (left + i * f.phraseW) * dpr;
    if (lx < cw && lx + mw > 0) maskCtx.drawImage(phraseMask, lx, 0, mw, mh);
  }
  maskCtx.globalCompositeOperation = "destination-in";
  maskCtx.fillStyle = grad(maskCtx, gx, gy, 45 * ud, R * ud, 0.45, 0.7);
  maskCtx.fillRect(0, 0, cw, ch);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(maskC, 0, 0);
}

function onMove(f: Foot, e: PointerEvent) {
  if (e.pointerType === "touch") return;
  f.px = e.clientX;
  f.py = e.clientY;
}

// phrase: one speed easing toward idle plus whatever the scroll adds
function drift(f: Foot, c: Ctx, busy: boolean) {
  const dt = c.dt,
    k = dt / 16.7;
  f.kick = clamp(f.kick * Math.pow(0.94, k) + c.dy * 0.0012, -0.35, 0.35);
  if (Math.abs(f.kick) < 0.0005) f.kick = 0;
  // 68 design px a second, 54 under the pointer
  f.phraseV += ((busy ? 0 : (f.hot ? 0.054 : 0.068) * c.u) + f.kick - f.phraseV) * (1 - Math.exp(-dt / 180));
  f.phraseX += f.phraseV * dt;
  f.rowX = -f.pad - mod(f.phraseX, f.phraseW || 1);
  f.row.style.transform = `translate3d(${f.rowX.toFixed(1)}px,0,0)`;
}

// dot pointer over the phrase band
function moveDot(f: Foot, r: DOMRect, c: Ctx, busy: boolean, lx: number, ly: number) {
  const k = c.dt / 16.7,
    u = c.u,
    { dot } = f;
  const was = f.hot;
  f.hot = !busy && f.px >= 0 && ly > r.height - 448 * u && ly < r.height - 88 * u;
  if (f.hot !== was) f.el.toggleAttribute("data-hot", f.hot);
  if (f.hot && f.dotAlpha === 0) {
    f.dotX = lx;
    f.dotY = ly;
  }
  if (f.hot || f.dotAlpha > 0) {
    if (f.px >= 0) {
      f.dotX += (lx - f.dotX) * Math.min(1, 0.22 * k);
      f.dotY += (ly - f.dotY) * Math.min(1, 0.22 * k);
    }
    f.dotAlpha += ((f.hot ? 1 : 0) - f.dotAlpha) * Math.min(1, 0.18 * k);
    if (!f.hot && f.dotAlpha < 0.004) f.dotAlpha = 0;
    dot.style.opacity = f.dotAlpha.toFixed(3);
    dot.style.transform = `translate3d(${(f.dotX - 7).toFixed(1)}px,${(f.dotY - 7).toFixed(1)}px,0) scale(${(0.4 + 0.6 * f.dotAlpha).toFixed(3)})`;
  }
}

// spot
function moveSpot(f: Foot, r: DOMRect, c: Ctx, busy: boolean, lx: number, ly: number) {
  const dt = c.dt,
    k = dt / 16.7,
    u = c.u,
    { hot } = f;
  const show = hot || (!busy && f.btn.matches(":focus-visible"));
  if (show && f.spotAlpha === 0) {
    f.ink = getComputedStyle(f.stage).getPropertyValue("--phr").trim() || "#8a8a8a";
    if (hot || f.spotX < 0) {
      f.spotX = hot ? lx : r.width / 2;
      f.spotY = hot ? ly : r.height - 210 * u;
    }
  }
  if (hot) {
    f.spotX += (lx - f.spotX) * Math.min(1, 0.18 * k);
    f.spotY += (ly - f.spotY) * Math.min(1, 0.18 * k);
  }
  f.spotAlpha = clamp(f.spotAlpha + ((show ? 1 : -1) * dt) / 450);
  const out = f.spotAlpha.toFixed(3);
  if (out !== f.spotOut) f.cut.style.opacity = f.spotOut = out;
  if (f.spotAlpha > 0.01) draw(f, r, u);
}

function tick(f: Foot, c: Ctx) {
  // the section's cached box first: a layout read here, on every frame of the whole page, cost phones about 4ms a frame
  if (c.top > c.vh || c.top + c.h < 0) return;
  const r = f.stage.getBoundingClientRect();
  if (r.bottom < 0 || r.top > c.vh || !r.width) return;
  const sec = c.dt / MS,
    busy = f.mt?.dataset.cards === "open";
  if (f.dirty) {
    f.dirty = false;
    measure(f, c);
  }
  drift(f, c, busy);

  if (!c.held) return;

  // the still's reveal
  f.reveal += (smooth(progressBetween(clamp((c.vh - r.top) / r.height), 0.25, 1)) - f.reveal) * Math.min(1, sec * 5);
  f.wall.style.opacity = f.reveal.toFixed(3);

  if (!c.fine) return;
  const lx = f.px - r.left,
    ly = f.py - r.top;
  moveDot(f, r, c, busy, lx, ly);
  moveSpot(f, r, c, busy, lx, ly);
}

function off(f: Foot, ac: AbortController) {
  ac.abort();
  for (const n of [f.cut, f.dot, ...f.clones]) n.parentNode?.removeChild(n);
  f.el.removeAttribute("data-hot");
  for (const n of [f.wall, f.row]) {
    n.style.removeProperty("transform");
    n.style.removeProperty("opacity");
  }
}

function setup(el: HTMLElement) {
  const stage = el.querySelector<HTMLElement>(".mt-stage");
  const wall = el.querySelector<HTMLElement>(".mt-fwall");
  const btn = el.querySelector<HTMLElement>(".mt-ph-btn");
  const row = el.querySelector<HTMLElement>(".mt-ph-row");
  if (!stage || !wall || !btn || !row) return;
  const cut = make(stage, "canvas", "mt-fcut");
  const dot = make(stage, "i", "mt-fdot");
  const g = cut.getContext("2d")!;
  const f: Foot = {
    el,
    stage,
    wall,
    btn,
    row,
    mt: el.closest<HTMLElement>(".mt"),
    cut,
    dot,
    g,
    bufs: { wash: buf(), blur: buf(), sharp: buf(), mask: buf() },
    clones: [],
    reveal: 0,
    dirty: true,
    px: -1,
    py: -1,
    phraseW: 0,
    pad: 0,
    phraseX: 0,
    phraseV: 0,
    kick: 0,
    rowX: 0,
    first: true,
    hot: false,
    dotX: 0,
    dotY: 0,
    dotAlpha: 0,
    spotX: -1,
    spotY: 0,
    spotAlpha: 0,
    spotOut: "",
    ink: "",
    phraseMask: null,
    maskZoom: 1,
  };
  const ac = new AbortController();
  const dirty = () => void (f.dirty = true);
  stage.addEventListener("pointermove", (e) => onMove(f, e), { signal: ac.signal });
  stage.addEventListener("pointerleave", () => void (f.px = -1), { signal: ac.signal });
  addEventListener("resize", dirty, { signal: ac.signal });
  document.fonts.ready.then(dirty);
  return { frame: (_p: number, _el: HTMLElement, c: Ctx) => tick(f, c), off: () => off(f, ac) };
}

export const footDrivers: Driver[] = [{ name: "foot", always: true, setup }];
