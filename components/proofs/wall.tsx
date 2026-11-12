"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import DriftWall from "@/components/drift-wall";
import { GRIDWALL, wallFill, type Gridwall } from "@/lib/proofs/gridwall";

/* ── the proof gate over the 404's wall (the default; ?proofwall=0 for the plain gate) ──
 * Julian (2026-11-10): the 404's wall (`DriftWall`) under a glass card,
 * carrying this gallery's own watermarked frames, and the move from
 * sign-in to gallery seamless. Then: the photos must not travel left or
 * right to reach the gallery. So the wall is laid out on the gallery's
 * own columns: one wall column of the grid's width for each, carrying
 * that column's frames in order, with spare columns either side for the
 * tilt, its tiles in the gallery's own shape. On Open proofs (Julian
 * 2026-11-11, "the wall becomes the gallery") each column carries on
 * from its speed at the click and eases into the slot where its photos
 * stand on the gallery's cells, while the wall turns flat and face on and
 * comes sharp. Once still the wall is the gallery to the pixel, and the
 * gallery takes over in place (`glide`).
 * ─────────────────────────────────────────────────────────────── */

const READY_AFTER_MS = 900; // after the wall shows: the columns mostly in before the focus pull
const READY_CAP_MS = 4000; // the card comes up by then, whatever the wall's photographs are doing
const PRELOAD_CAP_MS = 8000; // the longest the splash holds for the wall's photographs on a slow connection
const RETURN_CAP_MS = 2500; // the same on a return visit, when most photographs are cached
const SPLASH_MIN_MS = 1100; // the name's rise plays out even when everything is cached
const BAR_DONE_MS = 380; // the line runs full before the splash lifts
const ROWS = 6; // a wall column's length (DriftWall takes at most six)
const GLIDE_MS = 1600; // the wall turning flat while every column glides into its slot (proof.css --dw-flat)
const DECODE_CAP_MS = 1500; // the longest the hand-over waits on the gallery's first screen being drawn
const CARD_OUT_MS = 450; // `reveal`: the card gone before the gallery comes up
const RISE_MS = 900;

type Frame = { src: string; w: number; h: number };
type Box = { x: number; y: number; w: number; h: number; img: HTMLImageElement };

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Every loaded wall tile within a screen of the view, as a box in the viewport. */
function tilesNear(root: HTMLElement): Box[] {
  const out: Box[] = [];
  for (const img of root.querySelectorAll<HTMLImageElement>(".drift-wall__tile img.is-loaded")) {
    const r = img.getBoundingClientRect();
    if (r.width < 8 || r.width > innerWidth || r.bottom < -innerHeight || r.top > 2 * innerHeight) continue;
    out.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, img });
  }
  return out;
}

/** The grid's columns as "count,width,gap,offset from the middle of the screen,top of its first row": a string, so it compares. */
function gridShape(g: HTMLElement | null) {
  if (!g) return "";
  const cs = getComputedStyle(g);
  const cols = cs.gridTemplateColumns.split(" ").map(parseFloat).filter((n) => n > 0);
  if (!cols.length) return "";
  const gap = parseFloat(cs.columnGap) || 0;
  const left = g.getBoundingClientRect().left + (parseFloat(cs.paddingLeft) || 0);
  const width = cols.length * cols[0] + (cols.length - 1) * gap;
  // From the middle of the wall's layer, which stops short of a scrollbar.
  const top = g.getBoundingClientRect().top + (parseFloat(cs.paddingTop) || 0);
  return [cols.length, cols[0], gap, left + width / 2 - document.documentElement.clientWidth / 2, top].map((n) => Math.round(n * 100) / 100).join(",");
}
const onResize = (cb: () => void) => {
  addEventListener("resize", cb);
  return () => removeEventListener("resize", cb);
};

export function ProofWall({
  frames,
  grid,
  isEmail,
  onAccept,
  onDone,
  tune,
}: {
  frames: Frame[];
  /** The wall tuned per screen (lib/proofs/gridwall.ts); null with `?gw=0`. */
  tune?: Gridwall | null;
  grid: React.RefObject<HTMLDivElement | null>;
  isEmail: (v: string) => boolean;
  onAccept: (name: string, email: string) => void;
  onDone: () => void;
}) {
  const layer = React.useRef<HTMLDivElement>(null);
  const nameField = React.useRef<HTMLInputElement>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [bad, setBad] = React.useState<string | null>(null);
  // Julian (2026-11-10): the load-up should feel premium. The wall streams in sharp, every other column from above and below, then racks
  // focus to blur as the card rises in, its lines one after another (`[data-ready]`, proof.css).
  const [ready, setReady] = React.useState(false);
  const [flat, setFlat] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const shown = React.useCallback(() => {
    window.setTimeout(() => setReady(true), reducedMotion() ? 0 : READY_AFTER_MS);
  }, []);
  // A slow phone still gets the card soon: the wall comes in behind it.
  React.useEffect(() => {
    const t = window.setTimeout(() => setReady(true), READY_CAP_MS);
    return () => clearTimeout(t);
  }, []);

  // The wall on the grid's columns (the grid is laid out, hidden, under the gate).
  const shape = React.useSyncExternalStore(onResize, () => gridShape(grid.current), () => "");
  const wall = React.useMemo(() => {
    if (!shape || !frames.length) return null;
    const [n, w, gap, dx, top] = shape.split(",").map(Number);
    // Spare columns either side, enough to fill the tilted view (DriftWall's own "fill").
    const side = Math.max(1, Math.ceil((Math.ceil((innerWidth * (tune ? wallFill(innerWidth, innerHeight) : 1.5)) / (w + gap)) - n) / 2));
    const cols = n + 2 * side;
    // Row by row, as DriftWall deals them out (item i to column i % cols): an inner column carries
    // its grid column's frames top down, the spares the frames past the first screens.
    const items: { image: string }[] = [];
    let spare = n * ROWS;
    for (let r = 0; r < ROWS; r++)
      for (let j = 0; j < cols; j++) {
        const c = j - side;
        const i = c >= 0 && c < n ? c + r * n : spare++;
        items.push({ image: frames[i % frames.length].src });
      }
    // Tiles in the gallery's own shape (the middle frame's), so the flat wall stands on its cells.
    const shapes = frames.map((f) => (f.w && f.h ? f.h / f.w : 4 / 3)).sort((a, b) => a - b);
    const tall = shapes[shapes.length >> 1];
    return { items, cols, w, gap, dx, top, h: Math.round(w * tall) };
  }, [shape, frames, tune]);

  // Julian: photos loaded before they come into frame. Every photograph the wall carries is fetched and decoded
  // before it shows (the 800px copies, and the same files the gallery opens on), capped for a slow connection.
  // Julian: the splash (the name, a line filling under it) stays up until they are in, then lifts into the wall.
  const [loaded, setLoaded] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    if (!wall) return;
    let gone = false;
    const t0 = performance.now();
    // A return visit to this gallery: no minimum for the name, and a shorter wait on the photographs.
    const seenKey = `proof-seen:${location.pathname}`;
    const back = !!localStorage.getItem(seenKey);
    localStorage.setItem(seenKey, "1");
    let lift = 0;
    const done = () => {
      if (gone || lift) return;
      setProgress(1);
      lift = window.setTimeout(() => !gone && setLoaded(true), Math.max(BAR_DONE_MS, (back ? 0 : SPLASH_MIN_MS) - (performance.now() - t0)));
    };
    const cap = window.setTimeout(done, back ? RETURN_CAP_MS : PRELOAD_CAP_MS);
    const srcs = [...new Set(wall.items.map((i) => i.image))];
    let n = 0;
    void Promise.all(
      srcs.map((src) => {
        const img = new Image();
        img.src = src;
        return img
          .decode()
          .catch(() => {})
          .then(() => !gone && setProgress(++n / srcs.length));
      }),
    ).then(done);
    return () => {
      gone = true;
      clearTimeout(cap);
      clearTimeout(lift);
    };
  }, [wall]);

  // The cursor waits in the name field on a desktop; a phone's keyboard stays down until a tap.
  React.useEffect(() => {
    if (ready && matchMedia("(pointer: fine)").matches) nameField.current?.focus({ preventScroll: true });
  }, [ready]);

  // The page holds still under the wall.
  React.useEffect(() => {
    const el = document.documentElement;
    const was = el.style.overflow;
    el.style.overflow = "hidden";
    scrollTo(0, 0);
    return () => {
      el.style.overflow = was;
    };
  }, []);

  function open() {
    if (flat || leaving) return;
    if (reducedMotion()) reveal(true);
    else void glide();
  }

  /** Every wall column's tiles where they would stand with the wall flat and face on (laid out flat for a moment, unpainted). */
  function flatTracks() {
    const root = layer.current;
    const dw = root?.querySelector<HTMLElement>(".drift-wall");
    const plane = root?.querySelector<HTMLElement>(".drift-wall__plane");
    if (!root || !dw || !plane || !wall) return [];
    const was = [plane.style.transform, plane.style.transition, dw.style.scale, dw.style.transition];
    plane.style.transition = dw.style.transition = "none";
    plane.style.transform = `translate(calc(-50% + ${wall.dx}px), -50%)`;
    dw.style.scale = "1";
    const out = [...root.querySelectorAll<HTMLElement>(".drift-wall__track")].map((track) =>
      [...track.querySelectorAll<HTMLImageElement>(".drift-wall__tile img")].map((img) => {
        const r = img.getBoundingClientRect();
        return { img, y: r.top + r.height / 2 };
      }),
    );
    [plane.style.transform, plane.style.transition, dw.style.scale, dw.style.transition] = was;
    plane.getBoundingClientRect();
    return out;
  }

  /** Julian 2026-11-11 (the wall becomes the gallery, from the moment of the click): each column's speed is
   *  read as Open proofs is pressed and the column carries on from it, easing into the slot where its photos stand on the
   *  gallery's cells, while the wall turns flat and face on and comes sharp. The tiles that land already carry the
   *  gallery's frames (swapped while still soft, where a column stood on others); the ones above the grid fade. Once still,
   *  the wall is the gallery to the pixel: the gallery shows over it and the wall goes, nothing moves. */
  async function glide() {
    const g = grid.current;
    const root = layer.current;
    if (!g || !root || !wall) return reveal(false);
    const raf = () => new Promise<number>((r) => requestAnimationFrame(r));
    const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    // The gallery's first screen drawn by the time the wall lands.
    const imgs = [...g.querySelectorAll<HTMLImageElement>(".proof-cell img")].filter((i) => i.getBoundingClientRect().top < innerHeight);
    for (const i of imgs) i.loading = "eager";
    const drawn = Promise.race([Promise.all(imgs.map((i) => i.decode().catch(() => {}))), wait(GLIDE_MS + DECODE_CAP_MS)]);
    // Each column's speed, in flat pixels a second, over two frames.
    const t0 = await raf();
    const a = flatTracks();
    await raf();
    const t1 = await raf();
    const tracks = [...root.querySelectorAll<HTMLElement>(".drift-wall__track")];
    for (const t of tracks) for (const an of t.getAnimations()) an.pause();
    const b = flatTracks();
    const dt = Math.max(1, t1 - t0) / 1000;
    setLeaving(true);
    setFlat(true);

    const T = GLIDE_MS / 1000;
    const pitch = wall.h + wall.gap;
    const n = Number(shape.split(",")[0]);
    const side = (wall.cols - n) / 2;
    const cells = [...g.querySelectorAll<HTMLElement>(".proof-cell")];
    const glides: Animation[] = [];
    tracks.forEach((track, j) => {
      const now = b[j] ?? [];
      const v = now.length && a[j]?.length ? (now[0].y - a[j][0].y) / dt : 0;
      const c = j - side;
      // A coast: the speed it had, run down over the glide (start slope 3 on the curve, so a third of v·T).
      let D = (v * T) / 3;
      if (c >= 0 && c < n && cells[c]) {
        const r0 = cells[c].getBoundingClientRect();
        const y0 = r0.top + r0.height / 2;
        const order = [...now].sort((p, q) => p.y - q.y);
        // The slot ahead, the way it was going, if it is close; else the nearest: no column turns back far.
        const ahead = order.filter((t) => Math.sign(y0 - t.y) === Math.sign(v) && Math.abs(y0 - t.y) < pitch * 0.6);
        const pick = (ahead.length ? ahead : order).reduce((p, q) => (Math.abs(y0 - q.y) < Math.abs(y0 - p.y) ? q : p));
        D = y0 - pick.y;
        const k = order.indexOf(pick);
        order.forEach((t, i) => {
          const r = i - k;
          if (r < 0) {
            t.img.closest(".drift-wall__inner")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: GLIDE_MS * 0.55, easing: "ease-out", fill: "forwards" });
            return;
          }
          const cell = cells[c + r * n];
          if (!cell || t.y + D - pitch / 2 > innerHeight) return;
          const want = cell.querySelector("img")?.getAttribute("src");
          if (want && t.img.getAttribute("src") !== want) swap(t.img, want);
        });
      }
      // The curve's start slope set to the column's own speed, so it carries on from where it was, then settles.
      const y1 = Math.max(-0.3, Math.min(1, D ? (0.3 * v * T) / D : 0.9));
      glides.push(track.animate([{ translate: "0 0" }, { translate: `0 ${D}px` }], { duration: GLIDE_MS, easing: `cubic-bezier(.3,${y1},.25,1)`, fill: "forwards" }));
    });
    await Promise.all(glides.map((x) => x.finished.catch(() => {})));
    await drawn;
    handOver();
  }

  /** A tile's photograph changed under the blur: the new one fades in over it. */
  function swap(img: HTMLImageElement, src: string) {
    const ghost = img.cloneNode() as HTMLImageElement;
    ghost.removeAttribute("srcset");
    ghost.src = src;
    ghost.style.cssText = "position:absolute;inset:0";
    img.after(ghost);
    ghost.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: "ease", fill: "backwards" }).finished.then(
      () => (img.style.visibility = "hidden"),
      () => {},
    );
  }

  /** The wall standing still on the gallery: the gallery shows over it; a cell not quite on its tile eases the last of the way. */
  function handOver() {
    const root = layer.current;
    const tiles = root ? tilesNear(root).filter((t) => t.img.style.visibility !== "hidden") : [];
    flushSync(() => onAccept(name.trim().replace(/\s+/g, " "), email.trim()));
    const anims: Animation[] = [];
    for (const cell of grid.current?.querySelectorAll<HTMLElement>(".proof-cell") ?? []) {
      const to = cell.getBoundingClientRect();
      if (to.top > innerHeight) break;
      const src = cell.querySelector("img")?.getAttribute("src");
      const cx = to.left + to.width / 2;
      const cy = to.top + to.height / 2;
      let from: Box | null = null;
      for (const t of tiles) if (t.img.getAttribute("src") === src && (!from || Math.hypot(t.x - cx, t.y - cy) < Math.hypot(from.x - cx, from.y - cy))) from = t;
      if (from && Math.abs(from.x - cx) < 1.5 && Math.abs(from.y - cy) < 1.5 && Math.abs(from.w - to.width) < 2 && Math.abs(from.h - to.height) < 2) continue;
      const kf: Keyframe[] = from
        ? [{ transform: `translate(${from.x - cx}px, ${from.y - cy}px) scale(${from.w / to.width}, ${from.h / to.height})` }, { transform: "none" }]
        : [{ opacity: 0 }, { opacity: 1 }];
      anims.push(cell.animate(kf, { duration: tune ? GRIDWALL.handOver : 450, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" }));
    }
    const out = root?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: "ease-out", fill: "forwards" });
    Promise.all([out?.finished, ...anims.map((x) => x.finished)].map((p) => p?.catch(() => {}))).then(onDone);
  }

  /** Reduced motion, or the wall not measurable: nothing travels. The card goes, the wall stops and racks out of focus,
   *  and the gallery's first screen comes up in place over it once every photo in it is drawn. Reduced motion (Julian
   *  2026-11-11: "3d gridwall on email entering page and just fade in the proof gallery"): the wall stays, held still by
   *  DriftWall, and the gallery fades in over it while it fades out. */
  async function reveal(still: boolean) {
    setLeaving(true);
    const t0 = performance.now();
    const imgs = [...(grid.current?.querySelectorAll<HTMLImageElement>(".proof-cell img") ?? [])].filter((i) => i.getBoundingClientRect().top < innerHeight);
    for (const i of imgs) i.loading = "eager";
    const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    await Promise.race([Promise.all(imgs.map((i) => i.decode().catch(() => {}))), wait(DECODE_CAP_MS)]);
    await wait(Math.max(0, (still ? 0 : CARD_OUT_MS) - (performance.now() - t0)));
    const root = layer.current;
    flushSync(() => onAccept(name.trim().replace(/\s+/g, " "), email.trim()));
    const cells = [...(grid.current?.querySelectorAll<HTMLElement>(".proof-cell") ?? [])];
    const first = cells[0]?.getBoundingClientRect();
    const pitch = wall ? wall.w + wall.gap : 1;
    const anims: Animation[] = [];
    for (const cell of still ? [] : cells) {
      const r = cell.getBoundingClientRect();
      if (r.top > innerHeight) break;
      const col = Math.round((r.left - (first?.left ?? 0)) / pitch);
      const row = Math.round((r.top - (first?.top ?? 0)) / Math.max(1, first?.height ?? 1));
      anims.push(cell.animate([{ opacity: 0, transform: "translateY(10px) scale(.985)" }, { opacity: 1, transform: "none" }], { duration: RISE_MS, easing: "cubic-bezier(.22,1,.36,1)", delay: col * 80 + row * 50, fill: "backwards" }));
    }
    if (still) anims.push(...[grid.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: "ease", fill: "backwards" })].filter((a) => !!a));
    const out = root?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: still ? 600 : 1000, delay: still ? 0 : 250, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
    Promise.all([out?.finished, ...anims.map((a) => a.finished)].map((p) => p?.catch(() => {}))).then(onDone);
  }

  return (
    <>
      <div className="pw-splash" data-out={loaded || undefined} aria-hidden>
        <div className="pw-splash-name">
          <span>
            <span>Julian</span>
          </span>
          <span>
            <span>Gigola</span>
          </span>
        </div>
        <div className="pw-splash-bar">
          <i style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
      <div ref={layer} className="pw-layer" data-gw={tune ? "" : undefined} data-ready={ready || undefined} data-flat={flat || undefined} data-leave={leaving || undefined}>
        {wall && loaded ? (
          <DriftWall
            items={wall.items}
            columns={wall.cols}
            tileWidth={wall.w}
            tileHeight={wall.h}
            gap={wall.gap}
            radius={tune ? GRIDWALL.photoRadius : 0}
            speed={tune ? GRIDWALL.speed : 24}
            {...(tune && {
              tilt: GRIDWALL.tilt,
              turn: GRIDWALL.turn,
              depth: GRIDWALL.depth,
              perspective: GRIDWALL.persp,
              scale: tune.scale,
              offsetX: tune.x,
              offsetY: tune.y,
              // Each column starts on the gallery's first row, so Open proofs barely moves it (Julian: start at the top).
              start: wall.top,
            })}
            dim={0.6}
            overlayColor="var(--background)"
            density={0.5}
            flatten={flat ? wall.dx : undefined}
            hold={leaving}
            onShown={shown}
          />
        ) : null}
        <div aria-hidden className="pw-vig" />
        <div aria-hidden className="pw-grain" />
      </div>
      {/* `scale` applies after the card's translate(-50%,-50%), so a centered origin slid a grown card left; origin x 0 is the card's own center there.
          The phone portrait sheet is full width: it lays out at width/scale so the scaled card ends exactly at the screen edges. */}
      <form
        className="proof-card pw-card"
        style={
          tune
            ? innerWidth <= 520
              ? { scale: tune.card, borderRadius: tune.cardRadius, transformOrigin: "50% 100%", width: `calc(100% / ${tune.card})`, left: `calc(50% - 50% / ${tune.card})` }
              : { scale: tune.card, borderRadius: tune.cardRadius, transformOrigin: "0 50%" }
            : undefined
        }
        data-ready={ready || undefined}
        data-out={flat || leaving || undefined}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const msg = !name.trim() ? "Add your name." : !isEmail(email) ? "That email does not look right." : null;
          setBad(msg);
          if (!msg) open();
        }}
      >
        <div>
          <p className="proof-lab">Proofs · {frames.length} frames</p>
          <h1>Pick your proofs.</h1>
        </div>
        <label>
          <span className="proof-lab">Your name</span>
          <input
            ref={nameField}
            name="name"
            autoComplete="name"
            required
            value={name}
           
            aria-invalid={bad === "Add your name." || undefined}
            onChange={(e) => {
              setName(e.target.value);
              setBad(null);
            }}
          />
        </label>
        <label>
          <span className="proof-lab">Your email</span>
          <input
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
           
            aria-invalid={(!!bad && bad !== "Add your name.") || undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              setBad(null);
            }}
          />
        </label>
        {bad ? (
          <p className="proof-err" role="alert">
            {bad}
          </p>
        ) : null}
        <button type="submit" className="proof-btn" data-off={!name.trim() || !isEmail(email) || undefined}>
          Open proofs
        </button>
        <p className="proof-mu">Keep track of your favorites.</p>
      </form>
    </>
  );
}
