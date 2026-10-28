import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { Sharp } from "sharp";
import framing from "@/lib/share-framing.json";
import picks from "@/lib/share-picks.json";
import type { Frame } from "@/lib/work-types";

/* The share card (1200x630): the work on the right, the name on the left.
   Two verticals when the opening frames are verticals, otherwise one
   horizontal beside one vertical. Rendered at build time, so the fonts and
   photographs are read from disk. */

export const CARD_SIZE = { width: 1200, height: 630 };
export const CARD_TYPE = "image/png";

const ACCENT = "#50b7b7";
/** The site wordmark: mixed case, set tight, as in the header. */
const WORDMARK = "Julian Gigola";
const portrait = (f: Frame) => f.height > f.width;

/* Loaded only when a card is drawn, at build. A page rendered per request on
   the Worker (/book reads its query) still imports this file for its card's
   size and alt, and sharp cannot load there: a top-level import took /book down. */
const loadSharp = () => import("sharp").then((m) => m.default);

/** The frames a card shows. The first of the pool is always one of them. */
export const pickFrames = (pool: Frame[]): Frame[] => {
  const [first, ...rest] = pool;
  if (!first) return [];
  if (portrait(first) && rest[0] && portrait(rest[0])) return [first, rest[0]];
  const mate = rest.slice(0, 5).find((f) => portrait(f) !== portrait(first));
  return mate ? [first, mate] : [first];
};

/* Hand framing, from the Reframe page: where the middle of the slot falls on
   the photograph (x, y as fractions) and how far it is zoomed in (1 = filled). */
const FRAMING = framing as Record<string, { x: number; y: number; z: number }>;

/* Cropped to its slot at 1.5x with Lanczos, centred on the subject (from the top in a wide slot, where the face is), so the
   renderer never has to resample a 2500px photograph itself. */
const dataUri = async (key: string, src: string, w: number, h: number): Promise<{ uri: string; x: number; y: number }> => {
  const sharp = await loadSharp();
  const [tw, th] = [Math.round(w * 1.5), Math.round(h * 1.5)];
  const file = join(process.cwd(), "public", src);
  const jpeg = async (img: Sharp) => `data:image/jpeg;base64,${(await img.jpeg({ quality: 92, mozjpeg: true }).toBuffer()).toString("base64")}`;
  const hand = FRAMING[`${key}|${src}`];
  if (hand) {
    const { width: iw = 1, height: ih = 1 } = await sharp(file).metadata();
    const k = Math.max(tw / iw, th / ih) * Math.max(1, hand.z);
    const [sw, sh] = [Math.max(tw, Math.round(iw * k)), Math.max(th, Math.round(ih * k))];
    const big = await sharp(file).resize(sw, sh, { kernel: "lanczos3" }).toBuffer();
    const left = Math.max(0, Math.min(sw - tw, Math.round(hand.x * sw - tw / 2)));
    const top = Math.max(0, Math.min(sh - th, Math.round(hand.y * sh - th / 2)));
    return { uri: await jpeg(sharp(big).extract({ left, top, width: tw, height: th })), x: (left + tw / 2) / sw, y: (top + th / 2) / sh };
  }
  if (w > h * 0.9) {
    // A tall photograph in a wide slot: scale to the width and take the window
    // from just under the top, which holds the head and the chin.
    const scaled = await sharp(file).resize(tw, null, { kernel: "lanczos3" }).toBuffer({ resolveWithObject: true });
    if (scaled.info.height > th) {
      const top = Math.round((scaled.info.height - th) * 0.07);
      return { uri: await jpeg(sharp(scaled.data).extract({ left: 0, top, width: tw, height: th })), x: 0.5, y: (top + th / 2) / scaled.info.height };
    }
  }
  const fit = await sharp(file).resize(null, th, { kernel: "lanczos3" }).toBuffer({ resolveWithObject: true });
  if (fit.info.width > tw) {
    // Cropping the sides: centre the window on the subject, found as the pixels
    // furthest from the picture's median colour.
    const { data, info } = await sharp(fit.data).resize(48, 48, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const med = [0, 1, 2].map((c) => [...Array(info.width * info.height).keys()].map((i) => data[i * 3 + c]).sort((x, y) => x - y)[(info.width * info.height) >> 1]);
    const col = Array(info.width).fill(0);
    for (let i = 0; i < info.width * info.height; i++) {
      const d = Math.hypot(data[i * 3] - med[0], data[i * 3 + 1] - med[1], data[i * 3 + 2] - med[2]);
      col[i % info.width] += d * d;
    }
    const total = col.reduce((x, y) => x + y, 0);
    // The middle of the span that holds 84% of the subject, so a group of
    // people is framed whole rather than weighted toward its heavier side.
    const at = (q: number) => { let acc = 0; for (let x = 0; x < col.length; x++) { acc += col[x]; if (acc >= total * q) return (x + 0.5) / col.length; } return 0.5; };
    const cx = total ? (at(0.08) + at(0.92)) / 2 : 0.5;
    const left = Math.max(0, Math.min(fit.info.width - tw, Math.round(cx * fit.info.width - tw / 2)));
    return { uri: await jpeg(sharp(fit.data).extract({ left, top: 0, width: tw, height: th })), x: (left + tw / 2) / fit.info.width, y: 0.5 };
  }
  return { uri: await jpeg(sharp(file).resize(tw, th, { fit: "cover", position: sharp.strategy.attention, kernel: "lanczos3" })), x: 0.5, y: 0.5 };
};

const font = (name: string) => readFile(join(process.cwd(), "lib/og-fonts", name));

/** A client's mark from `assets/clients/`, as a light PNG for the dark panel,
    or null when it is not a transparent mark (a logo on its own tile). */
export const clientMark = async (file: string): Promise<string | null> => {
  const sharp = await loadSharp();
  const src = await readFile(join(process.cwd(), "assets/clients", file));
  const { data, info } = await sharp(src, { density: 300 }).trim().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let min = 255, sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    min = Math.min(min, data[i + 3]);
    if (data[i + 3] > 128) { sum += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; }
  }
  if (min > 250 || !n) return null;
  let img = sharp(data, { raw: info });
  if (sum / n < 128) img = img.negate({ alpha: false });
  const png = await img.resize(480, 165, { fit: "inside", kernel: "lanczos3" }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
};

/** Frames from public/ paths, sized from the files. */
export const framesOf = (srcs: string[]) =>
  Promise.all(srcs.map(async (src) => {
    const m = await (await loadSharp())(join(process.cwd(), "public", src)).metadata();
    return { src, width: m.width ?? 1, height: m.height ?? 1, alt: "", color: "#0b0b0a" };
  }));

export type Card = {
  kicker: string;
  title: string;
  /** "by Julian Gigola" on a project; a short line elsewhere. */
  byline?: string;
  frames: Frame[];
  /** Keep the title on one line (the name is never split). */
  oneLine?: boolean;
  /** Show these frames as given, without picking a pair. */
  exact?: boolean;
  /** The client's mark (`clientMark`), set in place of the title. */
  mark?: string | null;
  /** Width of the text panel; the home card gives its wordmark more room. */
  panel?: number;
};

/* Photos Julian picked on the Reframe page, by "kicker|title": cover first. */
const PICKS = picks as Record<string, string[]>;

export async function renderCard({ kicker, title: raw, byline = "by Julian Gigola", frames: given, oneLine, exact: givenExact, mark, panel }: Card) {
  const picked = PICKS[`${kicker}|${raw}`];
  const frames = picked?.length ? await framesOf(picked) : given;
  const exact = picked?.length ? true : givenExact;
  const isMark = raw === WORDMARK;
  const title = isMark ? raw : raw.toUpperCase();
  const shown = (exact ? frames.slice(0, 2) : pickFrames(frames)).reverse(); // the cover (first frame) sits on the right
  const PANEL = frames.length ? (panel ?? 400) : 1200, GAP = 6, W = 1200 - PANEL, H = 630;
  const two = shown.length === 2;
  const widths = two
    ? portrait(shown[0]) === portrait(shown[1]) ? [(W - GAP) / 2, (W - GAP) / 2]
      : portrait(shown[0]) ? [Math.min(300, W / 2 - GAP), W - Math.min(300, W / 2 - GAP) - GAP] : [W - Math.min(300, W / 2 - GAP) - GAP, Math.min(300, W / 2 - GAP)]
    : [W];
  const crops = await Promise.all(shown.map((f, i) => dataUri(`${kicker}|${raw}`, f.src, widths[i], H)));
  const uris = crops.map((c) => c.uri);
  const [black, mono] = await Promise.all([font("InterTight-900.ttf"), font("IBMPlexMono-500.ttf")]);
  const longest = oneLine ? title.length : Math.max(...title.split(/\s+/).map((w) => w.length));
  const size = Math.max(36, Math.min(isMark ? 120 : frames.length ? 80 : 100, Math.floor((PANEL - 80) * (frames.length ? 1 : 0.7) / (longest * (isMark ? 0.46 : oneLine ? 0.68 : 0.7)))));

  const res = new ImageResponse(
    (
      <div style={{ display: "flex", width: 1800, height: 945, background: "#0b0b0a" }}>
      <div style={{ display: "flex", width: 1200, height: H, background: "#0b0b0a", color: "#f2f1ee", transform: "scale(1.5)", transformOrigin: "top left" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: PANEL, padding: "44px 40px", fontFamily: "Plex" }}>
          <div style={{ display: "flex", fontFamily: "Tight", fontSize: 26, letterSpacing: -1.2 }}>{mark ? WORDMARK : ""}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 18, letterSpacing: 3, color: ACCENT, textTransform: "uppercase" }}>{kicker}</div>
            <div style={{ display: "flex", fontFamily: "Tight", fontSize: size, lineHeight: 1.0, letterSpacing: isMark ? -size * 0.05 : -1.5, marginTop: 18, whiteSpace: oneLine ? "nowrap" : "normal" }}>{title}</div>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 20, color: "#bdbbb5", marginTop: 8 }}>
              {byline.split("\n").map((l) => <div key={l} style={{ display: "flex", whiteSpace: "nowrap" }}>{l}</div>)}
            </div>
          </div>
          <div style={{ display: "flex", height: 56, alignItems: "flex-end" }}>
            {mark ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mark} alt="" style={{ maxWidth: 150, maxHeight: 56, objectFit: "contain", objectPosition: "left bottom" }} />
            ) : isMark ? null : (
              <div style={{ display: "flex", fontFamily: "Tight", fontSize: 26, letterSpacing: -1.2 }}>{WORDMARK}</div>
            )}
          </div>
        </div>
        <div style={{ display: frames.length ? "flex" : "none", width: W, height: H }}>
          {uris.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" width={widths[i]} height={H} style={{ width: widths[i], height: H, objectFit: "cover", marginLeft: i ? GAP : 0 }} />
          ))}
        </div>
      </div>
      </div>
    ),
    {
      width: 1800,
      height: 945,
      fonts: [
        { name: "Tight", data: black, weight: 900, style: "normal" },
        { name: "Plex", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
  // Dev only: the slots, for the Reframe page to draw.
  if (process.env.NODE_ENV === "development") res.headers.set("x-card-key", encodeURIComponent(`${kicker}|${raw}`));
  if (process.env.NODE_ENV === "development") res.headers.set("x-card-slots", JSON.stringify(shown.map((f, i) => ({ src: f.src, w: Math.round(widths[i]), h: H, x: +crops[i].x.toFixed(3), y: +crops[i].y.toFixed(3) }))));
  return res;
}
