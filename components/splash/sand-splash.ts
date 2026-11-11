/* ── `?splash=sand`: the name in sand, then the hero, a preview ──────
 * The hero's name gathers out of grains blown in from the left and stirs
 * under the pointer, then dissolves where it stands. As it goes, the
 * hero's first photograph fades in as sand in its own place, standing
 * in depth (its brightness is the relief) and turning with the pointer,
 * for as long as the page is still loading. Once the real hero is there
 * the relief goes flat onto it while the ground thins, so the live
 * photograph shows under the sand and the grains melt into it.
 * Replaces the contact sheet in this preview; if the photograph cannot
 * be read, the name dissolves and the sheet plays as before (`intro.tsx`).
 * Idea from the Gather teardown (GATHER.md); written here, nothing of
 * theirs copied. Opt-in only, behind the flag, until Julian says otherwise.
 *
 * Like the sheet, it is written into the page as source and run as the
 * document is read, so it touches nothing but the browser and its
 * argument. Julian: slow, nothing abrupt, no text on screen.
 * ─────────────────────────────────────────────────────────────── */
export function sand(photos: { d: string; l: string }) {
  const root = document.documentElement;
  if (root.dataset.splash !== "sand" || root.dataset.intro !== "1") return;
  // inside the sheet's HTML block, which React leaves alone when it hydrates
  const layer = document.querySelector("#jg-intro .jg-sheet-wrap");
  if (!layer) return;

  const GATHER = 2800; // the grains blowing in to make the name
  const HOLD = 1600; // the formed name standing
  const DISSOLVE = 1800; // the name coming apart where it is
  const RISE = 2200; // the hero's sand fading in, from halfway through the dissolve
  const FLOAT = 1200; // the relief at least this long, whole, before it settles
  const SETTLE = 2200; // the relief going flat onto the real photograph and melting into it
  const CAP = 14000; // never holds the page longer than this
  const GRAINS = 9000, DEPTH = 0.6;

  /* One pixel buffer at CSS size, written grain by grain each frame. */
  const W = innerWidth, H = innerHeight;
  const cv = document.createElement("canvas");
  cv.className = "jg-sand";
  cv.width = W;
  cv.height = H;
  layer.append(cv);
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(W, H), buf = new Uint32Array(img.data.buffer);
  const cs = getComputedStyle(root);
  const face = cs.getPropertyValue("--font-display").trim() || "sans-serif";
  ctx.fillStyle = cs.getPropertyValue("--foreground").trim() || "#eee";
  ctx.fillRect(0, 0, 1, 1);
  const [ir, ig, ib] = ctx.getImageData(0, 0, 1, 1).data;
  ctx.clearRect(0, 0, 1, 1);

  // the name: home on the letters, start, now, speed, one random each
  let n = 0;
  let hx = new Float32Array(0), hy = hx, sx = hx, sy = hx, x = hx, y = hx, vx = hx, vy = hx, rd = hx;
  // the photograph: place on the flat picture, depth, colour, one random each
  let m = 0;
  let qx = hx, qy = hx, qz = hx, qc = new Uint32Array(0), qr = hx;

  /* Grains on the letters: the hero's name exactly (`.a-cover h1`,
     v3.css): Inter Tight 900, -0.05em, min(13 x --v3u, 10rem), one line
     on a phone too (Julian), shrunk if it would not fit the width. */
  function deal() {
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const o = off.getContext("2d", { willReadFrequently: true })! as CanvasRenderingContext2D & { letterSpacing: string };
    const name = "Julian Gigola";
    o.font = `900 100px ${face}`;
    o.letterSpacing = "-5px";
    const size = Math.min((13 * (W / H >= 2 ? H : W)) / 100, 160, (W * 0.9 * 100) / o.measureText(name).width);
    o.font = `900 ${size}px ${face}`;
    o.letterSpacing = `${-0.05 * size}px`;
    o.textAlign = "center";
    o.textBaseline = "middle";
    o.fillText(name, W / 2, H / 2);
    const px = o.getImageData(0, 0, W, H).data, spots: number[] = [];
    const st = size < 90 ? 1 : 2; // a phone's smaller name samples finer, or it reads as noise
    for (let j = 0; j < H; j += st) for (let i = 0; i < W; i += st) if (px[(j * W + i) * 4 + 3] > 128) spots.push(i, j);
    n = Math.min(GRAINS, spots.length / 2);
    [hx, hy, sx, sy, x, y, vx, vy, rd] = Array.from({ length: 9 }, () => new Float32Array(n));
    for (let k = 0; k < n; k++) {
      const s = Math.floor(Math.random() * (spots.length / 2)) * 2;
      hx[k] = spots[s] + Math.random() * st;
      hy[k] = spots[s + 1] + Math.random() * st;
      // off screen on the left (Julian), a loose band around the name's height
      sx[k] = x[k] = -20 - Math.random() * W * 0.5;
      sy[k] = y[k] = hy[k] + (Math.random() - 0.5) * H * 0.5;
      rd[k] = Math.random();
    }
  }

  /* The hero's first photograph, small, read into grains laid out where
     the real one sits (`.a-cover .slides`, cover fit). */
  let photo: HTMLImageElement | null = null, rect = { l: 0, t: 0, w: W, h: H };
  const pic = new Image();
  pic.decoding = "async";
  pic.onload = () => (photo = pic);
  pic.src = root.dataset.theme === "light" ? photos.l : photos.d;

  /* Where the real hero is right now: the shown one of the pair (v3d or
     v3l, by theme), measured every frame, so the sand lands on it even if
     the layout moves while the page loads. With `k` below 1 the sand glides
     after a moved hero instead of jumping with it. */
  const hero = () => [...document.querySelectorAll<HTMLImageElement>(".a-cover .slides img.on")].find((i) => i.offsetWidth > 0);
  function measure(k = 1) {
    const r = (hero() ?? document.querySelector(".a-cover .slides"))?.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return;
    rect = { l: rect.l + (r.left - rect.l) * k, t: rect.t + (r.top - rect.t) * k, w: rect.w + (r.width - rect.w) * k, h: rect.h + (r.height - rect.h) * k };
  }

  function lay() {
    measure();
    const step = Math.max(3, Math.round(Math.sqrt((rect.w * rect.h) / 120000)));
    const gw = Math.ceil(rect.w / step), gh = Math.ceil(rect.h / step);
    const g = document.createElement("canvas");
    g.width = gw;
    g.height = gh;
    const o = g.getContext("2d", { willReadFrequently: true })!;
    // cropped as the real one is: cover, at its own object-position
    const h = hero(), [ox, oy] = (h ? getComputedStyle(h).objectPosition : "50% 50%").split(" ").map((v) => (parseFloat(v) || 50) / 100);
    const iw = photo!.naturalWidth, ih = photo!.naturalHeight, f = Math.max(gw / iw, gh / ih);
    o.drawImage(photo!, (gw - iw * f) * ox, (gh - ih * f) * oy, iw * f, ih * f);
    const px = o.getImageData(0, 0, gw, gh).data; // throws if the photo is not ours to read
    m = gw * gh;
    [qx, qy, qz, qr] = Array.from({ length: 4 }, () => new Float32Array(m));
    qc = new Uint32Array(m);
    for (let k = 0; k < m; k++) {
      const r0 = px[k * 4], g0 = px[k * 4 + 1], b0 = px[k * 4 + 2];
      qx[k] = ((k % gw) + 0.5) / gw;
      qy[k] = (Math.floor(k / gw) + 0.5) / gh;
      qz[k] = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255 - 0.5;
      qr[k] = Math.random();
      qc[k] = (b0 << 16) | (g0 << 8) | r0;
    }
  }

  /* The pointer's last few places push the name; its place turns the relief. */
  const trail: { x: number; y: number; dx: number; dy: number; t: number }[] = [];
  let px0 = -1, py0 = -1, mx = 0.5, my = 0.5;
  const onMove = (e: PointerEvent) => {
    if (px0 >= 0) trail.push({ x: e.clientX, y: e.clientY, dx: e.clientX - px0, dy: e.clientY - py0, t: performance.now() });
    if (trail.length > 6) trail.shift();
    px0 = e.clientX;
    py0 = e.clientY;
    mx = e.clientX / W;
    my = e.clientY / H;
  };
  addEventListener("pointermove", onMove);

  const ease = (s: number) => s * s * s * (s * (s * 6 - 15) + 10);
  const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const put = (px: number, py: number, c: number, sz: number) => {
    const i = px | 0, j = py | 0;
    if (i < 0 || j < 0 || i + sz > W || j + sz > H) return;
    for (let b = 0; b < sz; b++) for (let a = 0, p = (j + b) * W + i; a < sz; a++) buf[p + a] = c;
  };
  const alpha = (c: number, a: number) => (((a * 255) << 24) | c) >>> 0;

  let loaded = document.readyState === "complete";
  addEventListener("load", () => (loaded = true), { once: true });
  const heroReady = () => {
    const h = hero();
    return !h || (h.complete && h.naturalWidth > 0);
  };

  const inkc = (ib << 16) | (ig << 8) | ir;
  let t0 = 0, formed = 0, gone = 0, rise = 0, settle = 0, laid = false, ry = 0, rx = 0;
  function frame(now: number) {
    if (!t0) t0 = now;
    const tg = (now - t0) / GATHER;
    if (!formed && tg >= 1) formed = now;
    // the photograph's grains are built while the name stands still (a ~70ms task), not while it moves
    if (formed && photo && !laid && now - formed > 300) {
      try {
        lay();
        laid = true;
      } catch {
        photo = null;
      }
    }
    if (formed && !gone && now - formed > HOLD && (laid || !photo || now - t0 > CAP / 2)) gone = now;
    if (gone && laid && !rise && now - gone > DISSOLVE * 0.5) rise = now;
    const tr = rise ? (now - rise) / RISE : 0;
    if (rise && !settle && tr > 1 && now - rise > RISE + FLOAT && ((loaded && heroReady()) || now - t0 > CAP)) begin(now);
    const ts = settle ? clamp((now - settle) / SETTLE) : 0;
    buf.fill(0);

    /* The relief: fades in grain by grain, turned by the pointer and a
       slow sway. Settling, it goes flat onto the real hero, measured each
       frame, while the ground thins to show that photograph under it; the
       grains keep their size and melt into it, so nothing is swapped. */
    if (rise) {
      const t = now / 1000, s = ease(ts), flat = 1 - s;
      measure(0.06 + 0.94 * s * s); // glides after the hero, and is locked on it by the end of the settle
      ry += ((mx - 0.5) * 0.5 + Math.sin(t * 0.45) * 0.07 - ry) * 0.04;
      rx += (-(my - 0.5) * 0.3 + Math.sin(t * 0.33) * 0.04 - rx) * 0.04;
      const cyw = Math.cos(ry * flat), syw = Math.sin(ry * flat), cxp = Math.cos(rx * flat), sxp = Math.sin(rx * flat);
      const ccx = rect.l + rect.w / 2, ccy = rect.t + rect.h / 2, F = 1600;
      // a little deeper and further back as it fades in, then the slow way home
      const D = DEPTH * Math.min(rect.w, rect.h) * flat * (1.25 - 0.25 * ease(clamp(tr)));
      const zoom = 0.9 + 0.04 * ease(clamp(tr)) + 0.06 * s;
      // lifted while the grains stand alone on the ground, back to true as the photograph shows
      const lift = 1 + 0.45 * flat, out = 1 - ease(clamp((ts - 0.62) / 0.38));
      for (let k = 0; k < m; k++) {
        const a = ease(clamp(tr * 1.6 - qr[k] * 0.6)) * out;
        if (a <= 0) continue;
        const X = (qx[k] - 0.5) * rect.w, Y = (qy[k] - 0.5) * rect.h;
        const Z = qz[k] * D, X1 = X * cyw + Z * syw, Z1 = -X * syw + Z * cyw;
        const Y1 = Y * cxp - Z1 * sxp, Z2 = Y * sxp + Z1 * cxp, p = (zoom * F) / (F - Z2);
        const c = qc[k], r = Math.min(255, (c & 255) * lift), g = Math.min(255, ((c >> 8) & 255) * lift), b = Math.min(255, (c >> 16) * lift);
        put(ccx + X1 * p - 1, ccy + Y1 * p - 1, alpha((b << 16) | (g << 8) | r, a), 2);
      }
    }

    /* The name: blown in from off the left edge, the left letters first,
       on an arc; then each grain lets go, lifts and thins out where it is. */
    const td = gone ? (now - gone) / DISSOLVE : 0;
    if (td < 1) {
      const live = trail.filter((b) => now - b.t < 260);
      for (let k = 0; k < n; k++) {
        const e = ease(clamp(tg * 1.6 - (hx[k] / W) * 0.35 - rd[k] * 0.25));
        const hump = Math.sin(Math.PI * e) * (rd[k] - 0.5) * 120;
        let tx = sx[k] + (hx[k] - sx[k]) * e - hump * 0.3, ty = sy[k] + (hy[k] - sy[k]) * e + hump, a = 1;
        if (gone) {
          const g = clamp((td - rd[k] * 0.45) / 0.55), gg = g * g;
          tx += gg * (rd[k] - 0.5) * 50 + gg * 18;
          ty -= gg * (20 + 40 * rd[k]);
          a = 1 - ease(g);
        }
        // a spring toward it, so the pointer's push settles back
        vx[k] += (tx - x[k]) * 0.09;
        vy[k] += (ty - y[k]) * 0.09;
        for (const b of live) {
          const dx = x[k] - b.x, dy = y[k] - b.y, f = Math.exp(-(dx * dx + dy * dy) / 3600) * (0.5 + rd[k]);
          vx[k] += b.dx * f * 0.35;
          vy[k] += b.dy * f * 0.35;
        }
        vx[k] *= 0.8;
        vy[k] *= 0.8;
        x[k] += vx[k];
        y[k] += vy[k];
        if (a > 0.01) put(x[k], y[k], alpha(inkc, a * (0.8 + 0.2 * rd[k])), rd[k] > 0.7 ? 2 : 1);
      }
    } else if (!laid) return done(true);

    ctx.putImageData(img, 0, 0);
    if (settle && ts >= 1) return done(false);
    requestAnimationFrame(frame);
  }

  /* Settling: the page takes over as in the sheet's ending (`intro.tsx`)
     and the ground thins once the relief is nearly flat and lined up on
     it, so the real hero shows under the sand with no double image. */
  function begin(now: number) {
    settle = now;
    root.dataset.intro = "half";
    root.dataset.splashed = "";
    document.getElementById("jg-intro")?.classList.add("jg-intro-open");
    layer!.querySelector(".jg-sheet-ground")?.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: SETTLE * 0.5, delay: SETTLE * 0.45, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "forwards" });
  }

  function done(sheet: boolean) {
    removeEventListener("pointermove", onMove);
    cv.remove();
    if (sheet) dispatchEvent(new Event("jg-sand-done"));
    else root.removeAttribute("data-intro");
  }

  /* The name waits for its face, but not for long. */
  Promise.race([document.fonts.load(`900 100px ${face}`), new Promise((r) => setTimeout(r, 800))]).then(() => {
    deal();
    requestAnimationFrame(frame);
  });
}
