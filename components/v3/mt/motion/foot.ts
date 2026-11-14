import { projectHref } from "@/lib/project-href";
import { clamp, smooth, span, type Ctx, type Driver } from "./engine";

/* Footer, spec 3.10: wall reveal, drift and lean, phrase drift, dot pointer and
   hover spot, frame lift and open, phone row. Wall numbers are design units
   (1440x900) unless a name says px. */
const P = 1272; // one column loop: six frames at a 212 pitch
const PITCH = 212;
const R = 510; // spot radius
const OPEN = 800;
const mod = (v: number, m: number) => ((v % m) + m) % m;

type Col = { el: HTMLElement; figs: HTMLElement[]; imgs: (HTMLImageElement | null)[]; x: number; y: number; s: number; wr: string[] };

let tick: ((ctx: Ctx) => void) | null = null;

function setup(el: HTMLElement, ctx: Ctx) {
  const stage = el.querySelector<HTMLElement>(".mt-stage");
  const wall = el.querySelector<HTMLElement>(".mt-fwall");
  const frow = el.querySelector<HTMLElement>(".mt-frow");
  const btn = el.querySelector<HTMLElement>(".mt-ph-btn");
  const row = el.querySelector<HTMLElement>(".mt-ph-row");
  if (!stage || !wall || !frow || !btn || !row) return;
  const mt = el.closest<HTMLElement>(".mt");

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string) => {
    const n = document.createElement(tag);
    n.className = cls;
    n.setAttribute("aria-hidden", "true");
    return stage.appendChild(n);
  };
  const cut = make("canvas", "mt-fcut");
  const dot = make("i", "mt-fdot");
  const lift = make("div", "mt-flift");
  const limg = lift.appendChild(new Image());
  const lname = lift.appendChild(document.createElement("span"));
  limg.alt = "";
  lname.className = "lbl";
  const buf = () => {
    const c = document.createElement("canvas");
    return [c, c.getContext("2d")!] as const;
  };
  const g = cut.getContext("2d")!;
  const [Wc, w] = buf(), [Bc, b] = buf(), [Sc, s2] = buf(), [Mc, m] = buf();

  // wall
  let cols: Col[] = [], wu = ctx.u, dirty = true;
  let rv = 0, kick = 0, tx = 0, ty = 0, S = 1.14, pz = 1, mx = 0, my = 0;
  // pointer, client px
  let px = -1, py = -1, okT = false;
  // lift
  let hov: HTMLElement | null = null, ht = 0, LF: HTMLElement | null = null, TR: HTMLElement | null = null, dropT = 0, opened = false, timer = 0;
  // phrase
  let W = 0, pad = 0, x = 0, v = 0, pk = 0, tr = 0, first = true;
  const clones: Node[] = [];
  // dot and spot
  let hot = false, cx = 0, cy = 0, ca = 0, sx = -1, sy = 0, sa = 0, saOut = "", ground = "";
  let MK: HTMLCanvasElement | null = null, mz = 1;
  // phone row
  let rx = 0, rpz = 1, held = ctx.held;

  const collect = () => {
    cols = [...wall.children].map((c, i) => {
      const figs = [...c.children] as HTMLElement[];
      return { el: c as HTMLElement, figs, imgs: figs.map((f) => f.querySelector("img")), x: (c as HTMLElement).offsetLeft, y: cols[i]?.y ?? (i * 197) % P, s: (i % 2 ? 1 : -1) * (7 + ((i * 5) % 9)), wr: [] };
    });
    const f = cols[0]?.figs[0];
    wu = f?.offsetWidth ? f.offsetWidth / 150 : ctx.u;
  };

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

  /* The spot: the wall through the letters, sharp near the dot, blurred toward
     the edge. The canvas is only the spot's box inside the phrase band. */
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

    // the wall with the same matrix as the one behind, so both line up
    w.setTransform(dpr, 0, 0, dpr, 0, 0);
    w.fillStyle = ground;
    w.fillRect(0, 0, bw, bh);
    const ex = (1 - S) * (r.width / 2) + tx * wu - ox, ey = (1 - S) * (r.height / 2) + ty * wu - oy;
    w.setTransform(dpr * S, 0, 0, dpr * S, dpr * ex, dpr * ey);
    const x0 = -ex / S, x1 = (bw - ex) / S, y0 = -ey / S, y1 = (bh - ey) / S, fw = 150 * wu, fh = 200 * wu;
    for (const col of cols) {
      if (col.x + fw < x0 || col.x > x1) continue;
      col.imgs.forEach((im, j) => {
        const y = (mod(j * PITCH - col.y + 220, P) - 220) * wu;
        if (!im || !im.complete || !im.naturalWidth || y + fh < y0 || y > y1) return;
        const sc = Math.max(fw / im.naturalWidth, fh / im.naturalHeight), sw = fw / sc, sh = fh / sc;
        w.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, col.x, y, fw, fh);
      });
    }

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

  const hit = (cxp: number, cyp: number) => (document.elementsFromPoint(cxp, cyp).find((e) => e.parentElement?.classList.contains("mt-fcol")) as HTMLElement | undefined) ?? null;

  /** A larger file of the same photo from the image's own srcset. */
  const big = (im: HTMLImageElement) => {
    const set = im.srcset
      .split(",")
      .map((s) => s.trim().split(/\s+/))
      .map(([url, sz]) => ({ url, w: parseFloat(sz) }))
      .filter((s) => s.url && s.w)
      .sort((a, c) => a.w - c.w);
    return (set.find((s) => s.w >= Math.min(1600, innerWidth)) ?? set[set.length - 1])?.url;
  };

  const place = () => {
    if (!TR) return;
    const f = TR.getBoundingClientRect(), r = stage.getBoundingClientRect();
    Object.assign(lift.style, { left: `${f.left - r.left}px`, top: `${f.top - r.top}px`, width: `${f.width}px`, height: `${f.height}px` });
  };
  const raise = (fig: HTMLElement) => {
    const im = fig.querySelector("img");
    if (!im) return;
    LF = TR = fig;
    limg.src = im.currentSrc || im.src;
    // data-name carries the alt text: take the project title out of it, else the slug
    lname.textContent = /([^,.]+?) \([^)]*\), photographed/.exec(fig.dataset.name ?? "")?.[1].trim() ?? (fig.dataset.slug ?? "").replace(/-/g, " ");
    const url = big(im);
    if (url) {
      const pre = new Image();
      pre.onload = () => {
        if (TR === fig) limg.src = url;
      };
      pre.src = url;
    }
    place();
    lift.classList.add("on");
    el.setAttribute("data-lift", "");
  };
  const drop = () => {
    if (!LF || opened) return;
    LF = null;
    dropT = performance.now();
    lift.classList.remove("on");
    el.removeAttribute("data-lift");
  };
  const open = () => {
    const fig = LF;
    if (!fig || opened) return;
    opened = true;
    // to the screen's box in stage coordinates (an ancestor's transform rules out `fixed`)
    const r = stage.getBoundingClientRect();
    place();
    void lift.offsetWidth;
    lift.classList.add("open");
    Object.assign(lift.style, { left: `${-r.left}px`, top: `${-r.top}px`, width: `${innerWidth}px`, height: `${innerHeight}px` });
    timer = window.setTimeout(() => location.assign(projectHref(fig.dataset.slug)), OPEN);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    px = e.clientX;
    py = e.clientY;
    okT = !(e.target as Element).closest("a,button");
  };
  const onLeave = () => {
    px = -1;
  };
  const inWall = (r: DOMRect, y: number) => y - r.top < r.height * (545 / 900);
  const onClick = (e: MouseEvent) => {
    if (opened || mt?.dataset.cards === "open") return;
    const t = e.target as Element;
    if (t.closest("a,button")) return drop();
    if (ctx.held && ctx.fine) return open();
    // touch and the phone structures: first tap lifts, second opens
    const fig = ctx.held ? (inWall(stage.getBoundingClientRect(), e.clientY) ? hit(e.clientX, e.clientY) : null) : t.closest<HTMLElement>(".mt-frow figure");
    if (fig && fig === LF) open();
    else if (fig) raise(fig);
    else drop();
  };
  const onAway = (e: PointerEvent) => {
    if (LF && !(ctx.held && ctx.fine) && !stage.contains(e.target as Node)) drop();
  };
  const onResize = () => {
    dirty = true;
  };
  // back from the project (bfcache) must not land on the grown photo
  const onShow = (e: PageTransitionEvent) => {
    if (!e.persisted) return;
    clearTimeout(timer);
    opened = false;
    LF = null;
    lift.classList.remove("open", "on");
    lift.style.cssText = "";
    el.removeAttribute("data-lift");
  };
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerleave", onLeave);
  stage.addEventListener("click", onClick);
  document.addEventListener("pointerdown", onAway);
  addEventListener("resize", onResize);
  addEventListener("pageshow", onShow);
  document.fonts.ready.then(onResize);

  tick = (c) => {
    const r = stage.getBoundingClientRect();
    if (r.bottom < 0 || r.top > c.vh || !r.width) return;
    const dt = c.dt, k = dt / 16.7, sec = dt / 1000, u = c.u, busy = mt?.dataset.cards === "open";
    if (dirty) {
      dirty = false;
      collect();
      measure();
    }
    if (held !== c.held) {
      held = c.held;
      drop();
    }

    // phrase: one speed easing toward idle plus whatever the scroll adds
    pk = clamp(pk * Math.pow(0.94, k) + c.dy * 0.0012, -0.35, 0.35);
    if (Math.abs(pk) < 0.0005) pk = 0;
    v += ((busy ? 0 : 0.03 * u * (hot ? 0.22 : 1)) + pk - v) * (1 - Math.exp(-dt / 180));
    x += v * dt;
    tr = -pad - mod(x, W || 1);
    row.style.transform = `translate3d(${tr.toFixed(1)}px,0,0)`;

    if (!opened && (LF || performance.now() - dropT < 1000)) place();

    if (!c.held) {
      // phone row: each frame wraps on its own, there is no second copy
      const figs = frow.children as HTMLCollectionOf<HTMLElement>, n = figs.length;
      rpz += ((LF || opened || busy ? 0 : 1) - rpz) * Math.min(1, sec * 7);
      if (n > 1) {
        const p0 = figs[0].offsetLeft, pitch = figs[1].offsetLeft - p0, L = n * pitch;
        if (L >= c.vw + pitch) {
          rx += 14 * sec * rpz;
          const xm = mod(rx, L);
          for (let i = 0; i < n; i++) figs[i].style.transform = `translate3d(${(((i + 1) * pitch + p0 < xm ? L : 0) - xm).toFixed(1)}px,0,0)`;
        }
      }
      return;
    }

    // wall: reveal, lean, drift
    if (wall.childElementCount !== cols.length) collect();
    rv += (smooth(span(clamp((c.vh - r.top) / r.height), 0.25, 1)) - rv) * Math.min(1, sec * 5);
    kick += (Math.min(9, Math.abs(c.dy) * 0.25) - kick) * Math.min(1, sec * 6);
    if (c.fine && px >= 0) {
      mx = (px - r.left) / r.width - 0.5;
      my = (py - r.top) / r.height - 0.5;
    }
    if (!LF) {
      tx += (mx * -28 - tx) * Math.min(1, sec * 3);
      ty += (my * -20 - ty) * Math.min(1, sec * 3);
    }
    S = 1.14 - 0.08 * rv;
    pz += ((LF || opened ? 0 : 1) - pz) * Math.min(1, sec * 7);
    wall.style.opacity = rv.toFixed(3);
    wall.style.transform = `translate3d(${(tx * wu).toFixed(1)}px,${(ty * wu).toFixed(1)}px,0) scale(${S.toFixed(4)})`;
    const over = `translate3d(0,${(P * wu).toFixed(1)}px,0)`;
    for (const col of cols) {
      col.y = mod(col.y + col.s * sec * (1 + kick) * pz, P);
      col.el.style.transform = `translate3d(0,${(-col.y * wu).toFixed(1)}px,0)`;
      // six frames, no second copy: a frame that left the top goes under the last
      col.figs.forEach((f, j) => {
        const t = j * PITCH - col.y < -220 ? over : "";
        if (col.wr[j] !== t) {
          col.wr[j] = t;
          f.style.transform = t;
        }
      });
    }

    if (!c.fine) return;
    // dwell lift
    if (!opened) {
      const fig = !busy && okT && px >= 0 && inWall(r, py) ? hit(px, py) : null;
      if (fig !== hov) {
        hov = fig;
        ht = c.t;
        drop();
      } else if (fig && !LF && c.t - ht > 600) raise(fig);
    }

    // dot pointer over the phrase band
    const lx = px - r.left, ly = py - r.top;
    const was = hot;
    hot = !busy && !opened && px >= 0 && ly > r.height - 448 * u && ly < r.height - 88 * u;
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
      ground = getComputedStyle(cut).color;
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
    clearTimeout(timer);
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("pointerleave", onLeave);
    stage.removeEventListener("click", onClick);
    document.removeEventListener("pointerdown", onAway);
    removeEventListener("resize", onResize);
    removeEventListener("pageshow", onShow);
    for (const n of [cut, dot, lift, ...clones]) n.parentNode?.removeChild(n);
    el.removeAttribute("data-hot");
    el.removeAttribute("data-lift");
    for (const n of [wall, row, ...wall.querySelectorAll<HTMLElement>(".mt-fcol, figure"), ...(frow.children as HTMLCollectionOf<HTMLElement>)]) {
      n.style.removeProperty("transform");
      n.style.removeProperty("opacity");
    }
  };
}

export const footDrivers: Driver[] = [{ name: "foot", always: true, setup, frame: (_p, _el, ctx) => tick?.(ctx) }];
