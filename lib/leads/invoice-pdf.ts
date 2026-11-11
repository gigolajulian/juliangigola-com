import { balance, dayB, subtotal, usdB, type Invoice, type InvoiceB, type InvoiceFrom } from "./invoice";

/* ── the invoice as a PDF ─────────────────────────────────────────
 * Ported from Julian's JG INVOICE GENERATOR artifact (geometry measured
 * from his REF INVOICE.pdf): one draw list, written as a one-page vector
 * PDF in the site's faces (Julian, 2026-11-06: "update the fonts to match
 * my website"): IBM Plex Mono for labels and figures, Inter Tight for
 * names and notes, Inter Tight Black for the wordmark and INVOICE. Light paper only. New here: a Deposit paid line
 * and Balance due when a deposit is taken off, and his wordmark as the
 * site header sets it (Inter Tight Black at -0.045em) in place of the
 * stacked mark (Julian, 2026-11-06: "use my new wordmark instead"). Runs in the browser only,
 * loaded when he taps Make PDF, so the desk itself stays light. The fonts
 * come from /leads-app/invoice/ on that first tap.
 * ─────────────────────────────────────────────────────────────── */

export type InvoiceDoc = { from: InvoiceFrom; to: { name: string; email?: string; phone?: string }; inv: Invoice };

const PW = 594.95996, PH = 841.91998;
const RIGHT = 535.7;
const ROW0 = 407.75, PITCH = 19;
const BAND_H = 347;
const P = { PAGE: "#FFFFFF", BAND: "#FBFBFB", DARK: "#1F2229", GREY: "#828691", SLATE: "#9DA8BB", RULE: "#E7E8EC", BLUE: "#0099FF" };

/** asc, desc and gap: hhea's, in em, for CSS-like line boxes. */
type Font = { upem: number; bbox: number[]; asc: number; desc: number; gap: number; advUnits: (cp: number) => number; width: (s: string, size: number) => number };

function parseTTF(buf: ArrayBuffer): Font {
  const dv = new DataView(buf), n = dv.getUint16(4), tb: Record<string, { off: number }> = {};
  for (let i = 0; i < n; i++) {
    let tag = "";
    for (let k = 0; k < 4; k++) tag += String.fromCharCode(dv.getUint8(12 + i * 16 + k));
    tb[tag.trim()] = { off: dv.getUint32(12 + i * 16 + 8) };
  }
  const head = tb.head.off, upem = dv.getUint16(head + 18);
  const bbox = [dv.getInt16(head + 36), dv.getInt16(head + 38), dv.getInt16(head + 40), dv.getInt16(head + 42)];
  const numH = dv.getUint16(tb.hhea.off + 34);
  const asc = dv.getInt16(tb.hhea.off + 4) / upem, desc = -dv.getInt16(tb.hhea.off + 6) / upem, gap = dv.getInt16(tb.hhea.off + 8) / upem;
  const c = tb.cmap.off, nt = dv.getUint16(c + 2);
  let sub: number | null = null;
  for (let i = 0; i < nt; i++) {
    const pid = dv.getUint16(c + 4 + i * 8), eid = dv.getUint16(c + 6 + i * 8), o = dv.getUint32(c + 8 + i * 8);
    if ((pid === 3 && (eid === 1 || eid === 0)) || pid === 0) sub = c + o;
  }
  const map = new Map<number, number>();
  if (sub !== null && dv.getUint16(sub) === 4) {
    const segX2 = dv.getUint16(sub + 6), seg = segX2 / 2;
    const endO = sub + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
    for (let s = 0; s < seg; s++) {
      const end = dv.getUint16(endO + s * 2), start = dv.getUint16(startO + s * 2);
      const delta = dv.getInt16(deltaO + s * 2), ro = dv.getUint16(rangeO + s * 2);
      for (let u = start; u <= end && u !== 0xffff; u++) {
        let g;
        if (ro === 0) g = (u + delta) & 0xffff;
        else {
          const gi = rangeO + s * 2 + ro + (u - start) * 2;
          if (gi + 1 >= dv.byteLength) continue;
          g = dv.getUint16(gi);
          if (g) g = (g + delta) & 0xffff;
        }
        if (g) map.set(u, g);
      }
    }
  }
  const adv = (g: number) => dv.getUint16(tb.hmtx.off + (g < numH ? g : numH - 1) * 4);
  return {
    upem,
    bbox,
    asc,
    desc,
    gap,
    advUnits: (cp) => adv(map.get(cp) || 0),
    width: (s, size) => {
      let w = 0;
      for (const ch of s) w += adv(map.get(ch.codePointAt(0)!) || 0);
      return (w * size) / upem;
    },
  };
}

/** `tc` is letter-spacing in em; without it the wordmark face gets TRACK and the rest none. */
type Text = { x: number; y: number; size: number; fill: string; text: string; font: Face; anchor: "start" | "end"; tc?: number };
/** sb: IBM Plex Mono 500, labels and figures. rg: Inter Tight 500, names and notes. wm: Inter Tight Black, the wordmark and the title. B adds r4: Inter Tight 400, and ar: Archivo 800 at 125% width, the total. */
type Face = "sb" | "rg" | "wm" | "r4" | "ar";
/** The wordmark's tracking, as `site-header.tsx` sets the name. */
const TRACK = -0.045;
const WORDMARK = "Julian Gigola";
const money = (n: number) => `${n < 0 ? "-" : ""}${Math.abs(n).toFixed(2)} USD`;
const fmtDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${m}/${d}/${y}`; };

function wrap(text: string, maxW: number, font: Font) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (font.width(test, 8) > maxW) { out.push(line); line = words[i]; } else line = test;
    }
    out.push(line);
  }
  return out;
}

function layout({ from: s, to, inv }: InvoiceDoc, SB: Font, RG: Font) {
  const T: Text[] = [], rects: { x: number; y: number; w: number; h: number; fill: string }[] = [], lines: { x1: number; y: number; x2: number; c: string }[] = [];
  const t = (x: number, y: number, size: number, fill: string, text: string, font: Face = "sb", anchor: "start" | "end" = "start") => T.push({ x, y, size, fill, text, font, anchor });
  const W = (str: string, size: number, font: "sb" | "rg") => (font === "rg" ? RG : SB).width(str, size);

  // The wordmark where the stacked mark stood: top left, and small at the foot on the right.
  t(58.0, 96.41, 26, P.DARK, WORDMARK, "wm");
  t(RIGHT, 826.46, 12, P.DARK, WORDMARK, "wm", "end");

  rects.push({ x: 0, y: 0, w: PW, h: PH, fill: P.PAGE }, { x: 0, y: 0, w: PW, h: BAND_H, fill: P.BAND });

  t(RIGHT, 195.31, 22, P.DARK, "INVOICE", "wm", "end");
  t(58.44, 196.75, 8, P.DARK, "RECIPIENT");
  t(58.44, 224.58, 11, P.GREY, to.name, "rg");
  if (to.phone) { t(58.0, 299.85, 8, P.BLUE, "m"); t(72.2, 299.85, 8, P.GREY, to.phone); }
  if (to.email) { t(59.4, 312.85, 8, P.BLUE, "e"); t(68.2, 312.85, 8, P.GREY, to.email); }
  t(RIGHT, 222.75, 8, P.DARK, "INVOICE NO.", "sb", "end");
  t(RIGHT, 235.75, 8, P.GREY, inv.no, "sb", "end");
  t(RIGHT, 261.75, 8, P.DARK, "INVOICE DATE", "sb", "end");
  t(RIGHT, 274.75, 8, P.GREY, fmtDate(inv.date), "sb", "end");

  const emL = RIGHT - W(s.email, 8, "sb");
  t(emL - 8.01 - W("@", 8, "sb"), 134.75, 8, P.BLUE, "@");
  t(emL, 135.75, 8, P.GREY, s.email);
  const phL = RIGHT - W(s.phone, 8, "sb");
  t(phL - 9.82 - W("m", 8, "sb"), 149.75, 8, P.BLUE, "m");
  t(phL, 149.75, 8, P.GREY, s.phone);
  t(RIGHT, 70.41, 8, P.GREY, s.name, "rg", "end");
  t(RIGHT, 83.41, 8, P.GREY, `${s.a1} ${s.a2}`.trim(), "rg", "end");
  t(RIGHT, 96.41, 8, P.GREY, s.a3, "rg", "end");

  t(58.03, 375.85, 8, P.SLATE, "TASK DESCRIPTION");
  t(300.0, 375.75, 8, P.SLATE, "ITEM");
  t(427.7, 375.75, 8, P.SLATE, "RATE", "sb", "end");
  t(RIGHT, 375.75, 8, P.SLATE, "AMOUNT", "sb", "end");
  inv.lines.forEach((it, i) => {
    const y = ROW0 + i * PITCH;
    // A wide line shrinks to clear ITEM at x 300, measured, not counted.
    t(58.0, y, Math.min(8, (8 * 236) / Math.max(1, RG.width(it.desc, 8))), P.DARK, it.desc, "rg");
    t(307.0, y + 0.1, 8, P.DARK, String(it.qty));
    t(427.7, y + 1.1, 8, P.DARK, money(it.rate), "sb", "end");
    t(RIGHT, y, 8, P.DARK, money(it.qty * it.rate), "sb", "end");
  });

  const dy = (inv.lines.length - 1) * PITCH;
  lines.push({ x1: 58, y: 433.0 + dy, x2: 536, c: P.RULE });
  t(300.0, 450.75 + dy, 8, P.SLATE, "SUBTOTAL");
  t(RIGHT, 450.75 + dy, 8, P.DARK, money(subtotal(inv.lines)), "sb", "end");
  // The deposit, taken off: one more row, and everything under it moves down by it.
  const dz = inv.paid ? PITCH : 0;
  if (inv.paid) {
    t(300.0, 450.75 + dy + PITCH, 8, P.SLATE, "DEPOSIT PAID");
    t(RIGHT, 450.75 + dy + PITCH, 8, P.DARK, money(-inv.paid), "sb", "end");
  }
  lines.push({ x1: 300, y: 466.0 + dy + dz, x2: 536, c: P.RULE });
  t(298.0, 489.75 + dy + dz, 8, P.DARK, inv.paid ? "BALANCE DUE" : "TOTAL");
  t(RIGHT, 486.63 + dy + dz, 12, P.BLUE, money(balance(inv)), "sb", "end");
  t(RIGHT, 523.41 + dy + dz, 8, P.GREY, s.ein, "sb", "end");

  t(58.0, 695.65, 8, P.DARK, "NOTES");
  let ny = 721.31;
  for (const ln of wrap(inv.notes ?? s.notes, 478, RG)) { t(58.0, ny, 8, P.GREY, ln, "rg"); ny += 13; }
  ny = 760.31;
  // The name as typed; only an all-caps one (as the header block wants it) is set in title case.
  const signed = s.name === s.name.toUpperCase() ? s.name.replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a + b.toLowerCase()) : s.name;
  for (const ln of [s.signoff, signed]) { t(58.0, ny, 8, P.GREY, ln, "rg"); ny += 13; }

  lines.push({ x1: 58.5, y: 782.78, x2: 535.5, c: P.RULE });
  t(58.0, 806.46, 6, P.GREY, s.a1, "rg");
  t(58.0, 816.46, 6, P.GREY, s.a2, "rg");
  t(58.0, 826.46, 6, P.GREY, s.a3, "rg");
  t(220.0, 805.92, 6, P.BLUE, "@");
  t(234.0, 805.92, 6, P.GREY, s.email);
  t(220.0, 816.92, 6, P.BLUE, "m");
  t(232.0, 816.92, 6, P.GREY, s.phone);
  return { T, rects, lines };
}

/* ── design B: dark, the photo column on the left ──────────────────
 * Julian's approved B (prototypes/invoice-b, 2026-11-09), its CSS turned
 * into points: 1cqw is a hundredth of the page width, line boxes as CSS
 * builds them from each face's hhea metrics. The flow runs down from the
 * top; the sign-off and the footer sit on the foot. The photo comes in as
 * the framed column (`lib/leads/invoice-photo.ts`).
 * ─────────────────────────────────────────────────────────────── */
/** The least room between the bank block and the note: 4cqw, about two lines of the bank block. */
const CLEAR = 4 * (PW / 100);
const B = { BG: "#0D0D0F", FG: "#EDEDEF", MUTE: "#7C7F88", RULE: "#2A2B30", VIO: "#A99CF0", PAY: "#B9BBC2", CAP: "#B5B5B8", MARK: { dark: "#2E2F34", light: "#D9DADF" } };
const U = PW / 100;
/** B on the page: at full spacing, or with the gaps between blocks drawn in until the flow clears the sign-off. */
function layoutB(d: InvoiceDoc, F: Record<Face, Font>) {
  for (let k = 1; k > 0.3; k -= 0.05) { const L = layoutBAt(d, F, k); if (!L.overlap) return L; }
  return layoutBAt(d, F, 0.3);
}

/** `k` scales the gaps between blocks and the padding in the rows; type sizes never change. */
function layoutBAt({ from: s, inv }: InvoiceDoc, F: Record<Face, Font>, k: number) {
  const b = inv.b as InvoiceB;
  const T: Text[] = [], rects: { x: number; y: number; w: number; h: number; fill: string }[] = [], lines: { x1: number; y: number; x2: number; c: string }[] = [];
  const t = (x: number, y: number, size: number, fill: string, text: string, font: Face, anchor: "start" | "end" = "start", tc?: number) => T.push({ x, y, size, fill, text, font, anchor, tc });
  /** Advance with tracking, as the writer lays it. */
  const adv = (str: string, size: number, font: Face, tc = 0) => F[font].width(str, size) + tc * size * [...str].length;
  /** The baseline of a line box at `top`: `lh` its line-height in em, or the face's normal one. */
  const base = (top: number, size: number, font: Face, lh?: number) => { const f = F[font], h = lh ?? f.asc + f.desc + f.gap; return top + ((h - f.asc - f.desc) / 2 + f.asc) * size; };
  const box = (size: number, font: Face, lh?: number) => size * (lh ?? F[font].asc + F[font].desc + F[font].gap);
  /** A size that keeps `str` inside `w`. */
  const fit = (str: string, size: number, font: Face, w: number, tc = 0) => Math.min(size, (size * w) / Math.max(1, adv(str, size, font, tc)));

  const X0 = PW * 0.41 + 6 * U, XR = PW - 6 * U, LAB = 1.55 * U, HAIR = 0.75, colW = XR - X0;
  rects.push({ x: 0, y: 0, w: PW, h: PH, fill: B.BG });
  const lab = (x: number, top: number, str: string, fill = B.MUTE, anchor: "start" | "end" = "start") => { t(x, base(top, LAB, "sb", 1.4), LAB, fill, str.toUpperCase(), "sb", anchor, 0.06); return box(LAB, "sb", 1.4); };

  // On the photo: the wordmark in the shade read from under it, the caption at the foot.
  t(4.5 * U, base(5.5 * U, 3.6 * U, "wm", 0.9), 3.6 * U, B.MARK[b.tone], WORDMARK, "wm");
  const CAP = 1.45 * U, capTop = PH - 5 * U - 2 * box(CAP, "sb", 1.6), capW = PW * 0.41 - 8.5 * U;
  const p1 = b.project.toUpperCase(), p2 = b.caption.toUpperCase();
  if (p1) t(4.5 * U, base(capTop, CAP, "sb", 1.6), fit(p1, CAP, "sb", capW, 0.06), B.FG, p1, "sb", "start", 0.06);
  if (p2) t(4.5 * U, base(capTop + box(CAP, "sb", 1.6), CAP, "sb", 1.6), fit(p2, CAP, "sb", capW, 0.06), B.CAP, p2, "sb", "start", 0.06);

  // The flow, top down.
  let y = 6 * U;
  t(XR, base(y, 3.6 * U, "wm", 0.9), 3.6 * U, B.FG, "INVOICE", "wm", "end");
  y += box(3.6 * U, "wm", 0.9) + 0.5 * U;
  y += lab(XR, y, `#${inv.no}`, B.MUTE, "end");

  y += 6 * U * k;
  y += lab(X0, y, "Billed to") + 1.2 * U;
  const TO = 2.3 * U;
  for (const [str, fill] of [[b.to.name, B.FG], [b.to.company, B.FG], [b.to.email, B.MUTE]] as const) {
    if (!str) continue;
    t(X0, base(y, TO, "r4", 1.45), fit(str, TO, "r4", colW), fill, str, "r4");
    y += box(TO, "r4", 1.45);
  }

  y += 4 * U * k;
  lines.push({ x1: X0, y, x2: XR, c: B.RULE });
  y += HAIR;
  const IT = 2.1 * U, SUB = 1.75 * U, AMT = 1.95 * U;
  const rows = [...inv.lines.map((l) => ({ t: l.desc, sub: l.sub ?? "", n: l.qty * l.rate })), ...(inv.paid ? [{ t: "Deposit received", sub: b.depositNote, n: -inv.paid }] : [])];
  for (const r of rows) {
    const top = y + 2.2 * U * k, amt = usdB(r.n), room = colW - adv(amt, AMT, "sb") - 3 * U;
    t(X0, base(top, IT, "r4", 1.4), fit(r.t, IT, "r4", room), B.FG, r.t, "r4");
    t(XR, base(top, AMT, "sb"), AMT, B.FG, amt, "sb", "end");
    let h = box(IT, "r4", 1.4);
    if (r.sub) { t(X0, base(top + h + 0.5 * U, SUB, "r4", 1.4), fit(r.sub, SUB, "r4", room), B.MUTE, r.sub, "r4"); h += 0.5 * U + box(SUB, "r4", 1.4); }
    y = top + h + 2.2 * U * k;
    lines.push({ x1: X0, y, x2: XR, c: B.RULE });
    y += HAIR;
  }

  y += 6 * U * k;
  y += lab(X0, y, "Total due", B.VIO) + 2.4 * U;
  const K = 10.5 * U, total = usdB(balance(inv));
  t(X0, base(y, K, "ar", 0.82), fit(total, K, "ar", colW, -0.035), B.FG, total, "ar", "start", -0.035);
  y += box(K, "ar", 0.82) + 3.4 * U;
  const SM = 1.6 * U, sb = base(y, SM, "sb");
  let x = X0;
  for (const [k, v, c] of [["ISSUED ", dayB(inv.date), B.FG], ["DUE ", dayB(b.due, true), B.VIO]] as const) {
    t(x, sb, SM, B.MUTE, k, "sb", "start", 0.06); x += adv(k, SM, "sb", 0.06);
    t(x, sb, SM, c, v.toUpperCase(), "sb", "start", 0.06); x += adv(v.toUpperCase(), SM, "sb", 0.06) + 5 * U;
  }
  y += box(SM, "sb");

  y += 4.5 * U * k;
  y += lab(X0, y, "Bank transfer") + 1 * U;
  const PAY = 1.65 * U;
  for (const [str, fill] of [[s.bank, B.PAY], [s.routing && `Routing ${s.routing}`, B.PAY], [s.account && `Account ${s.account}`, B.PAY], [s.late, B.MUTE]] as const) {
    if (!str) continue;
    t(X0, base(y, PAY, "sb", 1.75), fit(str, PAY, "sb", colW), fill, str, "sb");
    y += box(PAY, "sb", 1.75);
  }
  const flowEnd = y;

  // The foot, bottom up: the footer, then the sign-off over it.
  const FT = 1.4 * U, ftTop = PH - 5 * U - box(FT, "sb") - 2.5 * U - HAIR;
  lines.push({ x1: X0, y: ftTop, x2: XR, c: B.RULE });
  const fb = base(ftTop + HAIR + 2.5 * U, FT, "sb");
  t(X0, fb, FT, B.MUTE, "JULIANGIGOLA.COM", "sb", "start", 0.06);
  if (s.tax) t(XR, fb, FT, B.MUTE, `TAX ${s.tax}`.toUpperCase(), "sb", "end", 0.06);

  const NP = 2.05 * U, note = b.note.filter(Boolean), NL = box(NP, "rg", 1.38), WM2 = 2.8 * U, EM = 1.4 * U;
  const signH = note.length * NL + 1.6 * U + NL + 2.6 * U + WM2 + 2.6 * U - 1.4 * U + box(EM, "sb");
  let sy = ftTop - 4.5 * U - signH;
  const signTop = sy;
  for (const ln of note) { t(XR, base(sy, NP, "rg", 1.38), fit(ln, NP, "rg", colW, -0.012), B.FG, ln, "rg", "end", -0.012); sy += NL; }
  sy += 1.6 * U;
  t(XR, base(sy, NP, "rg", 1.38), NP, B.MUTE, "Cheers,", "rg", "end", -0.012);
  sy += NL + 2.6 * U;
  t(XR, base(sy, WM2, "wm", 1), WM2, B.FG, WORDMARK, "wm", "end");
  sy += WM2 + 2.6 * U - 1.4 * U;
  t(XR, base(sy, EM, "sb"), EM, B.MUTE, "hello@juliangigola.com", "sb", "end", 0.04);

  return { T, rects, lines, img: { x: 0, y: 0, w: PW * 0.41, h: PH }, overlap: flowEnd > signTop - CLEAR };
}

/* ── the PDF itself ── */
const enc = (s: string) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; };
const concat = (arrs: Uint8Array[]) => { let n = 0; for (const a of arrs) n += a.length; const o = new Uint8Array(n); let p = 0; for (const a of arrs) { o.set(a, p); p += a.length; } return o; };
async function deflate(u8: Uint8Array) {
  const s = new Blob([u8 as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
// WinAnsi differs from Latin-1 in 0x80-0x9F: mapped both ways so widths and bytes agree.
const WIN_HI: Record<number, number> = { 0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178 };
const UNI_WIN: Record<number, number> = Object.fromEntries(Object.entries(WIN_HI).map(([b, u]) => [u, +b]));
const winByte = (cp: number) => UNI_WIN[cp] ?? (cp < 256 ? cp : 63);
const pesc = (s: string) => { let o = ""; for (const ch of s) { const c = String.fromCharCode(winByte(ch.codePointAt(0)!)); o += c === "\\" || c === "(" || c === ")" ? `\\${c}` : c; } return o; };
const hex2rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
const widths = (font: Font) => { const w: number[] = []; for (let c = 32; c <= 255; c++) w.push(Math.round((font.advUnits(WIN_HI[c] ?? c) * 1000) / font.upem)); return w; };

/** Each face: its file, its PDF name and stem. Light paper loads the first three; B adds the last two. */
const FACES: Record<Face, { file: string; name: string; stemv: number }> = {
  sb: { file: "plexmono-500.ttf", name: "IBMPlexMono-Medium", stemv: 80 },
  rg: { file: "intertight-500.ttf", name: "InterTight-Medium", stemv: 80 },
  wm: { file: "intertight-900.ttf", name: "InterTight-Black", stemv: 160 },
  r4: { file: "intertight-400.ttf", name: "InterTight-Regular", stemv: 70 },
  ar: { file: "archivo-800-125.ttf", name: "Archivo-ExtraBoldExpanded", stemv: 150 },
};
type Loaded = { bytes: Uint8Array; font: Font };
const loaded: Partial<Record<Face, Promise<Loaded>>> = {};
const BASE = "/leads-app/invoice";

function face(k: Face): Promise<Loaded> {
  return (loaded[k] ??= fetch(`${BASE}/${FACES[k].file}`)
    .then((r) => { if (!r.ok) throw new Error(`Could not load ${FACES[k].file}.`); return r.arrayBuffer(); })
    .then((buf) => ({ bytes: new Uint8Array(buf), font: parseTTF(buf) }))
    .catch((e) => { delete loaded[k]; throw e; }));
}

const who = (d: InvoiceDoc) => (d.inv.b ? (d.inv.b.to.company || d.inv.b.to.name).toUpperCase() : d.to.name);
export const fileName = (d: InvoiceDoc) => `INVOICE ${d.inv.no} - ${who(d).replace(/[\\/:*?"<>|]/g, "").trim()}.pdf`;

/** Design B's photo column, framed (`lib/leads/invoice-photo.ts`). */
export type Photo = { jpeg: Uint8Array; w: number; h: number };

/** The invoice as a PDF file, ready for Share or a download. A design B invoice needs its framed photo. */
export async function invoicePdf(d: InvoiceDoc, photo?: Photo): Promise<File> {
  const keys: Face[] = d.inv.b ? ["sb", "rg", "wm", "r4", "ar"] : ["sb", "rg", "wm"];
  const got = await Promise.all(keys.map(face));
  const F = Object.fromEntries(keys.map((k, i) => [k, got[i].font])) as Record<Face, Font>;
  const L = d.inv.b ? layoutB(d, F) : { ...layout(d, F.sb, F.rg), img: undefined };
  if ("overlap" in L && L.overlap) throw new Error("Too much for one page: drop a line or a short line under one.");
  const img = L.img && photo ? L.img : undefined;

  let s = "";
  for (const r of L.rects) { const [R, G, B] = hex2rgb(r.fill); s += `${f(R)} ${f(G)} ${f(B)} rg ${f(r.x)} ${f(PH - r.y - r.h)} ${f(r.w)} ${f(r.h)} re f\n`; }
  if (img) s += `q ${f(img.w)} 0 0 ${f(img.h)} ${f(img.x)} ${f(PH - img.y - img.h)} cm /Im1 Do Q\n`;
  // B's hairlines are CSS's 1px on A4, 0.75pt; the light page keeps its 1pt.
  const lw = d.inv.b ? 0.75 : 1;
  for (const l of L.lines) { const [R, G, B] = hex2rgb(l.c); s += `${f(R)} ${f(G)} ${f(B)} RG ${lw} w ${f(l.x1)} ${f(PH - l.y)} m ${f(l.x2)} ${f(PH - l.y)} l S\n`; }
  for (const o of L.T) {
    if (!o.text) continue;
    const font = F[o.font];
    // Tc spaces every glyph, the last one too, so a right-aligned run is pulled back by all of it.
    const tc = (o.tc ?? (o.font === "wm" ? TRACK : 0)) * o.size;
    const x = o.anchor === "end" ? o.x - font.width(o.text, o.size) - tc * [...o.text].length : o.x;
    const [R, G, B] = hex2rgb(o.fill);
    s += `BT ${f(R)} ${f(G)} ${f(B)} rg /F${keys.indexOf(o.font) + 1} ${f(o.size)} Tf ${f(tc)} Tc 1 0 0 1 ${f(x)} ${f(PH - o.y)} Tm (${pesc(o.text)}) Tj ET\n`;
  }
  const [content, ...zipped] = await Promise.all([deflate(enc(s)), ...got.map((g) => deflate(g.bytes))]);

  const objs: (string | Uint8Array)[] = [];
  const put = (body: string | Uint8Array) => objs.push(body);
  const stream = (dict: string, bytes: Uint8Array) => concat([enc(`${dict}\nstream\n`), bytes, enc("\nendstream")]);
  // 1 catalog, 2 pages, 3 page, 4 content, then three objects a face, then the photo.
  const fontId = (i: number) => 5 + i * 3, imgId = 5 + keys.length * 3;
  put("<< /Type /Catalog /Pages 2 0 R >>");
  put("<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << ${keys.map((_, i) => `/F${i + 1} ${fontId(i)} 0 R`).join(" ")} >>${img ? ` /XObject << /Im1 ${imgId} 0 R >>` : ""} >> /Contents 4 0 R >>`);
  put(stream(`<< /Length ${content.length} /Filter /FlateDecode >>`, content));
  keys.forEach((k, i) => {
    const { name, stemv } = FACES[k], font = F[k], id = fontId(i);
    put(`<< /Type /Font /Subtype /TrueType /BaseFont /${name} /FirstChar 32 /LastChar 255 /Widths [${widths(font).join(" ")}] /Encoding /WinAnsiEncoding /FontDescriptor ${id + 1} 0 R >>`);
    put(`<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${font.bbox.map((v) => Math.round((v * 1000) / font.upem)).join(" ")}] /ItalicAngle 0 /Ascent 969 /Descent -241 /CapHeight 727 /StemV ${stemv} /FontFile2 ${id + 2} 0 R >>`);
    put(stream(`<< /Length ${zipped[i].length} /Length1 ${got[i].bytes.length} /Filter /FlateDecode >>`, zipped[i]));
  });
  if (img && photo) put(stream(`<< /Type /XObject /Subtype /Image /Width ${photo.w} /Height ${photo.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${photo.jpeg.length} >>`, photo.jpeg));

  const chunks: Uint8Array[] = [enc("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  let pos = chunks[0].length;
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(pos);
    const head = enc(`${i + 1} 0 obj\n`), tail = enc("\nendobj\n"), mid = body instanceof Uint8Array ? body : enc(body);
    chunks.push(head, mid, tail);
    pos += head.length + mid.length + tail.length;
  });
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  chunks.push(enc(xref));
  return new File([concat(chunks) as BlobPart], fileName(d), { type: "application/pdf" });
}
