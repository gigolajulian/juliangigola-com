import { clamp, smooth, span, type Ctx, type Driver } from "./engine";

/* Footer, spec 3.10: the still's reveal, phrase drift, dot pointer and hover
   spot. The wall is one still (foot.tsx), so the column drift, the frame lift
   and open, and the phone row are gone. Numbers are design units (1440x900)
   unless a name says px. */
const R = 510; // spot radius
const mod = (v: number, m: number) => ((v % m) + m) % m;

let tick: ((ctx: Ctx) => void) | null = null;

function setup(el: HTMLElement, ctx: Ctx) {
  const stage = el.querySelector<HTMLElement>(".mt-stage");
  const wall = el.querySelector<HTMLElement>(".mt-fwall");
  const btn = el.querySelector<HTMLElement>(".mt-ph-btn");
  const row = el.querySelector<HTMLElement>(".mt-ph-row");
  if (!stage || !wall || !btn || !row) return;
  const mt = el.closest<HTMLElement>(".mt");

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string) => {
    const n = document.createElement(tag);
    n.className = cls;
    n.setAttribute("aria-hidden", "true");
    return stage.appendChild(n);
  };
  const cut = make("canvas", "mt-fcut");
  const dot = make("i", "mt-fdot");
  const buf = () => {
    const c = document.createElement("canvas");
    return [c, c.getContext("2d")!] as const;
  };
  const g = cut.getContext("2d")!;
  const [Wc, w] = buf(), [Bc, b] = buf(), [Sc, s2] = buf(), [Mc, m] = buf();

  // the still's reveal
  let rv = 0, dirty = true;
  // pointer, client px
  let px = -1, py = -1;
  // phrase
  let W = 0, pad = 0, x = 0, v = 0, pk = 0, tr = 0, first = true;
  const clones: Node[] = [];
  // dot and spot
  let hot = false, cx = 0, cy = 0, ca = 0, sx = -1, sy = 0, sa = 0, saOut = "", ink = "";
  let MK: HTMLCanvasElement | null = null, mz = 1;

  const measure = () => {
    W = (row.firstElementChild as HTMLElement).getBoundingClientRect().width;
    pad = parseFloat(getComputedStyle(row).paddingLeft) || 0;
    // ultrawide: three copies do not span the loop, add more
    for (let n = row.children.length; W > 0 && (n - 1) * W < ctx.vw; n++) clones.push(row.appendChild(row.lastElementChild!.cloneNode(true)));
    // start with a copy at the resting position and one already off to its left
    if (first && W) {
      x = -pad;
      first = false;
    }
    MK = null;
  };

  /* One phrase as a mask. Drawn at 280px or less with no canvas scale: above
     about 300px fillText punches the variable font's overlaps out as holes. */
  const mask = (br: DOMRect) => {
    const ph = row.firstElementChild as HTMLElement, cs = getComputedStyle(ph), fs = parseFloat(cs.fontSize), pr = ph.getBoundingClientRect();
    mz = Math.min(1, 280 / fs);
    const c = document.createElement("canvas"), k = c.getContext("2d")!;
    c.width = Math.ceil(W * mz);
    c.height = Math.ceil(br.height * mz);
    const probe = document.createElement("b");
    probe.style.cssText = "display:inline-block;width:0;height:0";
    ph.firstElementChild!.appendChild(probe);
    const base = (probe.getBoundingClientRect().top - br.top) * mz;
    probe.remove();
    k.font = `${cs.fontWeight} ${fs * mz}px ${cs.fontFamily}`;
    k.fillStyle = k.strokeStyle = "#fff";
    // a hair wider than the letters, or their grey edge shows around the photo
    k.lineWidth = 1.5 * mz;
    k.lineJoin = "round";
    for (const l of ph.children) {
      const lx = (l.getBoundingClientRect().left - pr.left) * mz;
      k.fillText(l.textContent ?? "", lx, base);
      k.strokeText(l.textContent ?? "", lx, base);
    }
    return c;
  };

  const fit = (c: HTMLCanvasElement, cw: number, ch: number) => {
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
  };
  const grad = (k: CanvasRenderingContext2D, gx: number, gy: number, r0: number, r1: number, at: number, a: number) => {
    const gr = k.createRadialGradient(gx, gy, r0, gx, gy, r1);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(at, `rgba(0,0,0,${a})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    return gr;
  };

  /* The spot: the letters rest lit (foot.css) and go back to the plain grey
     near the dot. Idle and hover traded places (Julian, 2026-11-15); before,
     the letters rested grey and the spot lit them. The canvas is only the
     spot's box inside the phrase band. */
  const draw = (r: DOMRect, u: number) => {
    const br = btn.getBoundingClientRect();
    if (!MK && W && document.fonts.status === "loaded") MK = mask(br);
    if (!MK) return;
    const dpr = Math.min(2, devicePixelRatio || 1), Ru = R * u, bw = 2 * Ru, bh = br.height;
    const snap = (n: number) => Math.round(n * dpr) / dpr;
    const ox = snap(sx - Ru), oy = snap(br.top - r.top);
    const cw = Math.round(bw * dpr), ch = Math.round(bh * dpr);
    if (cut.width !== cw || cut.height !== ch) {
      cut.style.width = `${bw}px`;
      cut.style.height = `${bh}px`;
    }
    fit(cut, cw, ch);
    fit(Wc, cw, ch);
    fit(Sc, cw, ch);
    fit(Mc, cw, ch);
    fit(Bc, Math.ceil(cw / 6), Math.ceil(ch / 6));
    cut.style.transform = `translate3d(${ox}px,${oy}px,0)`;

    // the resting grey over the lit letters, at full strength (the falloff is in the gradients below)
    w.setTransform(dpr, 0, 0, dpr, 0, 0);
    w.fillStyle = ink;
    w.fillRect(0, 0, bw, bh);

    const gx = (sx - ox) * dpr, gy = (sy - oy) * dpr, ud = u * dpr;
    // blur without ctx.filter (Safari): down to 1/6 and back up
    b.imageSmoothingQuality = "high";
    b.globalCompositeOperation = "copy";
    b.drawImage(Wc, 0, 0, Bc.width, Bc.height);
    s2.globalCompositeOperation = "copy";
    s2.drawImage(Wc, 0, 0);
    s2.globalCompositeOperation = "destination-in";
    s2.fillStyle = grad(s2, gx, gy, 40 * ud, 300 * ud, 0.35, 0.85);
    s2.fillRect(0, 0, cw, ch);
    g.imageSmoothingQuality = "high";
    g.globalCompositeOperation = "copy";
    g.drawImage(Bc, 0, 0, cw, ch);
    g.globalCompositeOperation = "source-over";
    g.drawImage(Sc, 0, 0);

    // letters in view, times the spot falloff
    m.globalCompositeOperation = "source-over";
    m.clearRect(0, 0, cw, ch);
    const left = br.left - r.left + pad + tr - ox, mw = (MK.width / mz) * dpr, mh = (MK.height / mz) * dpr;
    for (let i = 0; i < row.children.length; i++) {
      const lx = (left + i * W) * dpr;
      if (lx < cw && lx + mw > 0) m.drawImage(MK, lx, 0, mw, mh);
    }
    m.globalCompositeOperation = "destination-in";
    m.fillStyle = grad(m, gx, gy, 45 * ud, R * ud, 0.45, 0.7);
    m.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(Mc, 0, 0);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    px = e.clientX;
    py = e.clientY;
  };
  const onLeave = () => {
    px = -1;
  };
  const onResize = () => {
    dirty = true;
  };
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerleave", onLeave);
  addEventListener("resize", onResize);
  document.fonts.ready.then(onResize);

  tick = (c) => {
    // the section's cached box first: a layout read here, on every frame of the whole page, cost phones about 4ms a frame
    if (c.top > c.vh || c.top + c.h < 0) return;
    const r = stage.getBoundingClientRect();
    if (r.bottom < 0 || r.top > c.vh || !r.width) return;
    const dt = c.dt, k = dt / 16.7, sec = dt / 1000, u = c.u, busy = mt?.dataset.cards === "open";
    if (dirty) {
      dirty = false;
      measure();
    }
    // phrase: one speed easing toward idle plus whatever the scroll adds
    pk = clamp(pk * Math.pow(0.94, k) + c.dy * 0.0012, -0.35, 0.35);
    if (Math.abs(pk) < 0.0005) pk = 0;
    // 68 design px a second, 54 under the pointer (Julian, 2026-11-15: 30 passed too slow and nearly stopped on hover, 90 was a bit fast; the hover speed stayed)
    v += ((busy ? 0 : (hot ? 0.054 : 0.068) * u) + pk - v) * (1 - Math.exp(-dt / 180));
    x += v * dt;
    tr = -pad - mod(x, W || 1);
    row.style.transform = `translate3d(${tr.toFixed(1)}px,0,0)`;

    if (!c.held) return;

    // the still's reveal
    rv += (smooth(span(clamp((c.vh - r.top) / r.height), 0.25, 1)) - rv) * Math.min(1, sec * 5);
    wall.style.opacity = rv.toFixed(3);

    if (!c.fine) return;

    // dot pointer over the phrase band
    const lx = px - r.left, ly = py - r.top;
    const was = hot;
    hot = !busy && px >= 0 && ly > r.height - 448 * u && ly < r.height - 88 * u;
    if (hot !== was) el.toggleAttribute("data-hot", hot);
    if (hot && ca === 0) {
      cx = lx;
      cy = ly;
    }
    if (hot || ca > 0) {
      if (px >= 0) {
        cx += (lx - cx) * Math.min(1, 0.22 * k);
        cy += (ly - cy) * Math.min(1, 0.22 * k);
      }
      ca += ((hot ? 1 : 0) - ca) * Math.min(1, 0.18 * k);
      if (!hot && ca < 0.004) ca = 0;
      dot.style.opacity = ca.toFixed(3);
      dot.style.transform = `translate3d(${(cx - 7).toFixed(1)}px,${(cy - 7).toFixed(1)}px,0) scale(${(0.4 + 0.6 * ca).toFixed(3)})`;
    }

    // spot
    const show = hot || (!busy && btn.matches(":focus-visible"));
    if (show && sa === 0) {
      ink = getComputedStyle(stage).getPropertyValue("--phr").trim() || "#8a8a8a";
      if (hot || sx < 0) {
        sx = hot ? lx : r.width / 2;
        sy = hot ? ly : r.height - 210 * u;
      }
    }
    if (hot) {
      sx += (lx - sx) * Math.min(1, 0.18 * k);
      sy += (ly - sy) * Math.min(1, 0.18 * k);
    }
    sa = clamp(sa + ((show ? 1 : -1) * dt) / 450);
    const out = sa.toFixed(3);
    if (out !== saOut) cut.style.opacity = saOut = out;
    if (sa > 0.01) draw(r, u);
  };

  return () => {
    tick = null;
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("pointerleave", onLeave);
    removeEventListener("resize", onResize);
    for (const n of [cut, dot, ...clones]) n.parentNode?.removeChild(n);
    el.removeAttribute("data-hot");
    for (const n of [wall, row]) {
      n.style.removeProperty("transform");
      n.style.removeProperty("opacity");
    }
  };
}

export const footDrivers: Driver[] = [{ name: "foot", always: true, setup, frame: (_p, _el, ctx) => tick?.(ctx) }];
