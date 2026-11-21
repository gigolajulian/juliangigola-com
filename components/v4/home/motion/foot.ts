import { clamp, smooth, span, type Ctx, type Driver } from "./engine";

/* Footer, spec 3.10: the still's reveal, phrase drift, dot pointer and hover
   spot. The wall is one still (foot.tsx), so the column drift, the frame lift
   and open, and the phone row are gone. Numbers are design units (1440x900)
   unless a name says px. */
const R = 510; // spot radius
const mod = (v: number, m: number) => ((v % m) + m) % m;

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
  const [washC, wash] = buf(), [blurC, blur] = buf(), [sharpC, sharp] = buf(), [maskC, maskCtx] = buf();

  // the still's reveal
  let reveal = 0, dirty = true;
  // pointer, client px
  let px = -1, py = -1;
  // phrase
  let phraseW = 0, pad = 0, phraseX = 0, phraseV = 0, kick = 0, rowX = 0, first = true;
  const clones: Node[] = [];
  // dot and spot
  let hot = false, dotX = 0, dotY = 0, dotAlpha = 0, spotX = -1, spotY = 0, spotAlpha = 0, spotOut = "", ink = "";
  let phraseMask: HTMLCanvasElement | null = null, maskZoom = 1;

  const measure = () => {
    phraseW = (row.firstElementChild as HTMLElement).getBoundingClientRect().width;
    pad = parseFloat(getComputedStyle(row).paddingLeft) || 0;
    // ultrawide: three copies do not span the loop, add more
    for (let n = row.children.length; phraseW > 0 && (n - 1) * phraseW < ctx.vw; n++) clones.push(row.appendChild(row.lastElementChild!.cloneNode(true)));
    // start with a copy at the resting position and one already off to its left
    if (first && phraseW) {
      phraseX = -pad;
      first = false;
    }
    phraseMask = null;
  };

  /* One phrase as a mask. Drawn at 280px or less with no canvas scale: above
     about 300px fillText punches the variable font's overlaps out as holes. */
  const mask = (br: DOMRect) => {
    const ph = row.firstElementChild as HTMLElement, cs = getComputedStyle(ph), fs = parseFloat(cs.fontSize), pr = ph.getBoundingClientRect();
    maskZoom = Math.min(1, 280 / fs);
    const c = document.createElement("canvas"), k = c.getContext("2d")!;
    c.width = Math.ceil(phraseW * maskZoom);
    c.height = Math.ceil(br.height * maskZoom);
    const probe = document.createElement("b");
    probe.style.cssText = "display:inline-block;width:0;height:0";
    ph.firstElementChild!.appendChild(probe);
    const base = (probe.getBoundingClientRect().top - br.top) * maskZoom;
    probe.remove();
    k.font = `${cs.fontWeight} ${fs * maskZoom}px ${cs.fontFamily}`;
    k.fillStyle = k.strokeStyle = "#fff";
    // a hair wider than the letters, or their grey edge shows around the photo
    k.lineWidth = 1.5 * maskZoom;
    k.lineJoin = "round";
    for (const l of ph.children) {
      const lx = (l.getBoundingClientRect().left - pr.left) * maskZoom;
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
     near the dot. The canvas is only the
     spot's box inside the phrase band. */
  const draw = (r: DOMRect, u: number) => {
    const br = btn.getBoundingClientRect();
    if (!phraseMask && phraseW && document.fonts.status === "loaded") phraseMask = mask(br);
    if (!phraseMask) return;
    const dpr = Math.min(2, devicePixelRatio || 1), Ru = R * u, bw = 2 * Ru, bh = br.height;
    const snap = (n: number) => Math.round(n * dpr) / dpr;
    const ox = snap(spotX - Ru), oy = snap(br.top - r.top);
    const cw = Math.round(bw * dpr), ch = Math.round(bh * dpr);
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
    wash.fillStyle = ink;
    wash.fillRect(0, 0, bw, bh);

    const gx = (spotX - ox) * dpr, gy = (spotY - oy) * dpr, ud = u * dpr;
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
    const left = br.left - r.left + pad + rowX - ox, mw = (phraseMask.width / maskZoom) * dpr, mh = (phraseMask.height / maskZoom) * dpr;
    for (let i = 0; i < row.children.length; i++) {
      const lx = (left + i * phraseW) * dpr;
      if (lx < cw && lx + mw > 0) maskCtx.drawImage(phraseMask, lx, 0, mw, mh);
    }
    maskCtx.globalCompositeOperation = "destination-in";
    maskCtx.fillStyle = grad(maskCtx, gx, gy, 45 * ud, R * ud, 0.45, 0.7);
    maskCtx.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(maskC, 0, 0);
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
  const ac = new AbortController();
  stage.addEventListener("pointermove", onMove, { signal: ac.signal });
  stage.addEventListener("pointerleave", onLeave, { signal: ac.signal });
  addEventListener("resize", onResize, { signal: ac.signal });
  document.fonts.ready.then(onResize);

  const tick = (c: Ctx) => {
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
    kick = clamp(kick * Math.pow(0.94, k) + c.dy * 0.0012, -0.35, 0.35);
    if (Math.abs(kick) < 0.0005) kick = 0;
    // 68 design px a second, 54 under the pointer
    phraseV += ((busy ? 0 : (hot ? 0.054 : 0.068) * u) + kick - phraseV) * (1 - Math.exp(-dt / 180));
    phraseX += phraseV * dt;
    rowX = -pad - mod(phraseX, phraseW || 1);
    row.style.transform = `translate3d(${rowX.toFixed(1)}px,0,0)`;

    if (!c.held) return;

    // the still's reveal
    reveal += (smooth(span(clamp((c.vh - r.top) / r.height), 0.25, 1)) - reveal) * Math.min(1, sec * 5);
    wall.style.opacity = reveal.toFixed(3);

    if (!c.fine) return;

    // dot pointer over the phrase band
    const lx = px - r.left, ly = py - r.top;
    const was = hot;
    hot = !busy && px >= 0 && ly > r.height - 448 * u && ly < r.height - 88 * u;
    if (hot !== was) el.toggleAttribute("data-hot", hot);
    if (hot && dotAlpha === 0) {
      dotX = lx;
      dotY = ly;
    }
    if (hot || dotAlpha > 0) {
      if (px >= 0) {
        dotX += (lx - dotX) * Math.min(1, 0.22 * k);
        dotY += (ly - dotY) * Math.min(1, 0.22 * k);
      }
      dotAlpha += ((hot ? 1 : 0) - dotAlpha) * Math.min(1, 0.18 * k);
      if (!hot && dotAlpha < 0.004) dotAlpha = 0;
      dot.style.opacity = dotAlpha.toFixed(3);
      dot.style.transform = `translate3d(${(dotX - 7).toFixed(1)}px,${(dotY - 7).toFixed(1)}px,0) scale(${(0.4 + 0.6 * dotAlpha).toFixed(3)})`;
    }

    // spot
    const show = hot || (!busy && btn.matches(":focus-visible"));
    if (show && spotAlpha === 0) {
      ink = getComputedStyle(stage).getPropertyValue("--phr").trim() || "#8a8a8a";
      if (hot || spotX < 0) {
        spotX = hot ? lx : r.width / 2;
        spotY = hot ? ly : r.height - 210 * u;
      }
    }
    if (hot) {
      spotX += (lx - spotX) * Math.min(1, 0.18 * k);
      spotY += (ly - spotY) * Math.min(1, 0.18 * k);
    }
    spotAlpha = clamp(spotAlpha + ((show ? 1 : -1) * dt) / 450);
    const out = spotAlpha.toFixed(3);
    if (out !== spotOut) cut.style.opacity = spotOut = out;
    if (spotAlpha > 0.01) draw(r, u);
  };

  const off = () => {
    ac.abort();
    for (const n of [cut, dot, ...clones]) n.parentNode?.removeChild(n);
    el.removeAttribute("data-hot");
    for (const n of [wall, row]) {
      n.style.removeProperty("transform");
      n.style.removeProperty("opacity");
    }
  };
  return { frame: (_p: number, _el: HTMLElement, c: Ctx) => tick(c), off };
}

export const footDrivers: Driver[] = [{ name: "foot", always: true, setup }];
