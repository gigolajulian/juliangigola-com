import { balance, subtotal, type Invoice, type InvoiceFrom } from "./invoice";

/* ── the invoice as a PDF ─────────────────────────────────────────
 * Ported from Julian's JG INVOICE GENERATOR artifact (geometry measured
 * from his REF INVOICE.pdf): one draw list, written as a one-page vector
 * PDF with Inter embedded. Light paper only. New here: a Deposit paid line
 * and Balance due when a deposit is taken off. Runs in the browser only,
 * loaded when he taps Make PDF, so the desk itself stays light. The fonts
 * and the mark come from /leads-app/invoice/ on that first tap.
 * ─────────────────────────────────────────────────────────────── */

export type InvoiceDoc = { from: InvoiceFrom; to: { name: string; email?: string; phone?: string }; inv: Invoice };

const PW = 594.95996, PH = 841.91998;
const RIGHT = 535.7;
const ROW0 = 407.75, PITCH = 19;
const BAND_H = 347;
const P = { PAGE: "#FFFFFF", BAND: "#FBFBFB", DARK: "#1F2229", GREY: "#828691", SLATE: "#9DA8BB", RULE: "#E7E8EC", BLUE: "#0099FF" };

type Font = { upem: number; bbox: number[]; advUnits: (cp: number) => number; width: (s: string, size: number) => number };

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
    advUnits: (cp) => adv(map.get(cp) || 0),
    width: (s, size) => {
      let w = 0;
      for (const ch of s) w += adv(map.get(ch.codePointAt(0)!) || 0);
      return (w * size) / upem;
    },
  };
}

type Text = { x: number; y: number; size: number; fill: string; text: string; font: "sb" | "rg"; anchor: "start" | "end" };
const money = (n: number) => `${n < 0 ? "-" : ""}${Math.abs(n).toFixed(2)} USD`;
const fmtDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${m}/${d}/${y}`; };

function wrap(text: string, maxW: number, SB: Font) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (SB.width(test, 8) > maxW) { out.push(line); line = words[i]; } else line = test;
    }
    out.push(line);
  }
  return out;
}

function layout({ from: s, to, inv }: InvoiceDoc, SB: Font, RG: Font) {
  const T: Text[] = [], rects: { x: number; y: number; w: number; h: number; fill: string }[] = [], lines: { x1: number; y: number; x2: number; c: string }[] = [];
  const images = [{ x: 59, y: 51, w: 72, h: 72 }, { x: 471, y: 791, w: 42, h: 42 }];
  const t = (x: number, y: number, size: number, fill: string, text: string, font: "sb" | "rg" = "sb", anchor: "start" | "end" = "start") => T.push({ x, y, size, fill, text, font, anchor });
  const W = (str: string, size: number, font: "sb" | "rg") => (font === "rg" ? RG : SB).width(str, size);

  rects.push({ x: 0, y: 0, w: PW, h: PH, fill: P.PAGE }, { x: 0, y: 0, w: PW, h: BAND_H, fill: P.BAND });

  t(445.0, 195.31, 22, P.DARK, "INVOICE");
  t(58.44, 196.75, 8, P.DARK, "RECIPIENT");
  t(58.44, 224.58, 11, P.GREY, to.name, "rg");
  if (to.phone) { t(58.0, 299.85, 8, P.BLUE, "m"); t(72.2, 299.85, 8, P.GREY, to.phone); }
  if (to.email) { t(59.4, 312.85, 8, P.BLUE, "e"); t(68.2, 312.85, 8, P.GREY, to.email); }
  t(487.0, 222.75, 8, P.DARK, "INVOICE NO.");
  t(RIGHT, 235.75, 8, P.GREY, inv.no, "sb", "end");
  t(480.0, 261.75, 8, P.DARK, "INVOICE DATE");
  t(RIGHT, 274.75, 8, P.GREY, fmtDate(inv.date), "sb", "end");

  const emL = RIGHT - W(s.email, 8, "rg");
  t(emL - 8.01 - W("@", 8, "sb"), 134.75, 8, P.BLUE, "@");
  t(emL, 135.75, 8, P.GREY, s.email, "rg");
  const phL = RIGHT - W(s.phone, 8, "sb");
  t(phL - 9.82 - W("m", 8, "sb"), 149.75, 8, P.BLUE, "m");
  t(phL, 149.75, 8, P.GREY, s.phone);
  t(RIGHT, 70.41, 8, P.GREY, s.name, "sb", "end");
  t(RIGHT, 83.41, 8, P.GREY, `${s.a1} ${s.a2}`.trim(), "sb", "end");
  t(RIGHT, 96.41, 8, P.GREY, s.a3, "sb", "end");

  t(58.03, 375.85, 8, P.SLATE, "TASK DESCRIPTION");
  t(300.0, 375.75, 8, P.SLATE, "ITEM");
  t(427.7, 375.75, 8, P.SLATE, "RATE", "sb", "end");
  t(RIGHT, 375.75, 8, P.SLATE, "AMOUNT", "sb", "end");
  inv.lines.forEach((it, i) => {
    const y = ROW0 + i * PITCH;
    t(58.0, y, 8, P.DARK, it.desc.toUpperCase());
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
  for (const ln of wrap(inv.notes ?? s.notes, 478, SB)) { t(58.0, ny, 8, P.GREY, ln); ny += 13; }
  ny = 760.31;
  for (const ln of [s.signoff, s.name.replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a + b.toLowerCase())]) { t(58.0, ny, 8, P.GREY, ln); ny += 13; }

  lines.push({ x1: 58.5, y: 782.78, x2: 535.5, c: P.RULE });
  t(58.0, 806.46, 6, P.GREY, s.a1);
  t(58.0, 816.46, 6, P.GREY, s.a2);
  t(58.0, 826.46, 6, P.GREY, s.a3);
  t(220.0, 805.92, 6, P.BLUE, "@");
  t(234.0, 805.92, 6, P.GREY, s.email);
  t(220.0, 816.92, 6, P.BLUE, "m");
  t(232.0, 816.92, 6, P.GREY, s.phone);
  return { T, rects, lines, images };
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

type Assets = { sb: Uint8Array; rg: Uint8Array; SB: Font; RG: Font; logo: { W: number; H: number; gray: Uint8Array; alpha: Uint8Array } };
let assets: Promise<Assets> | null = null;
const BASE = "/leads-app/invoice";

async function loadAssets(): Promise<Assets> {
  const bytes = (p: string) => fetch(`${BASE}/${p}`).then((r) => { if (!r.ok) throw new Error(`Could not load ${p}.`); return r.arrayBuffer(); });
  const [sbBuf, rgBuf, png] = await Promise.all([bytes("inter-semibold.ttf"), bytes("inter-regular.ttf"), fetch(`${BASE}/mark.png`).then((r) => r.blob())]);
  const bmp = await createImageBitmap(png);
  const cv = document.createElement("canvas");
  cv.width = bmp.width;
  cv.height = bmp.height;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const gray = new Uint8Array(cv.width * cv.height), alpha = new Uint8Array(cv.width * cv.height);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) { gray[p] = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8; alpha[p] = px[i + 3]; }
  return { sb: new Uint8Array(sbBuf), rg: new Uint8Array(rgBuf), SB: parseTTF(sbBuf), RG: parseTTF(rgBuf), logo: { W: cv.width, H: cv.height, gray, alpha } };
}

export const fileName = (d: InvoiceDoc) => `INVOICE ${d.inv.no} - ${d.to.name.replace(/[\\/:*?"<>|]/g, "").trim()}.pdf`;

/** The invoice as a PDF file, ready for Share or a download. */
export async function invoicePdf(d: InvoiceDoc): Promise<File> {
  assets ??= loadAssets().catch((e) => { assets = null; throw e; });
  const { sb, rg, SB, RG, logo } = await assets;
  const L = layout(d, SB, RG);

  let s = "";
  for (const r of L.rects) { const [R, G, B] = hex2rgb(r.fill); s += `${f(R)} ${f(G)} ${f(B)} rg ${f(r.x)} ${f(PH - r.y - r.h)} ${f(r.w)} ${f(r.h)} re f\n`; }
  for (const i of L.images) s += `q ${f(i.w)} 0 0 ${f(i.h)} ${f(i.x)} ${f(PH - i.y - i.h)} cm /Im0 Do Q\n`;
  for (const l of L.lines) { const [R, G, B] = hex2rgb(l.c); s += `${f(R)} ${f(G)} ${f(B)} RG 1 w ${f(l.x1)} ${f(PH - l.y)} m ${f(l.x2)} ${f(PH - l.y)} l S\n`; }
  for (const o of L.T) {
    if (!o.text) continue;
    const font = o.font === "sb" ? SB : RG;
    const x = o.anchor === "end" ? o.x - font.width(o.text, o.size) : o.x;
    const [R, G, B] = hex2rgb(o.fill);
    s += `BT ${f(R)} ${f(G)} ${f(B)} rg /${o.font === "sb" ? "F1" : "F2"} ${o.size} Tf 1 0 0 1 ${f(x)} ${f(PH - o.y)} Tm (${pesc(o.text)}) Tj ET\n`;
  }
  const [content, grayZ, alphaZ, sbZ, rgZ] = await Promise.all([deflate(enc(s)), deflate(logo.gray), deflate(logo.alpha), deflate(sb), deflate(rg)]);
  const desc = (font: Font, name: string, stemv: number, id: number) =>
    `<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${font.bbox.map((v) => Math.round((v * 1000) / font.upem)).join(" ")}] /ItalicAngle 0 /Ascent 969 /Descent -241 /CapHeight 727 /StemV ${stemv} /FontFile2 ${id} 0 R >>`;

  const objs: (string | Uint8Array)[] = [];
  const put = (body: string | Uint8Array) => objs.push(body);
  const stream = (dict: string, bytes: Uint8Array) => concat([enc(`${dict}\nstream\n`), bytes, enc("\nendstream")]);
  put("<< /Type /Catalog /Pages 2 0 R >>");
  put("<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 5 0 R /F2 8 0 R >> /XObject << /Im0 11 0 R >> >> /Contents 4 0 R >>`);
  put(stream(`<< /Length ${content.length} /Filter /FlateDecode >>`, content));
  put(`<< /Type /Font /Subtype /TrueType /BaseFont /Inter-SemiBold /FirstChar 32 /LastChar 255 /Widths [${widths(SB).join(" ")}] /Encoding /WinAnsiEncoding /FontDescriptor 6 0 R >>`);
  put(desc(SB, "Inter-SemiBold", 80, 7));
  put(stream(`<< /Length ${sbZ.length} /Length1 ${sb.length} /Filter /FlateDecode >>`, sbZ));
  put(`<< /Type /Font /Subtype /TrueType /BaseFont /Inter-Regular /FirstChar 32 /LastChar 255 /Widths [${widths(RG).join(" ")}] /Encoding /WinAnsiEncoding /FontDescriptor 9 0 R >>`);
  put(desc(RG, "Inter-Regular", 60, 10));
  put(stream(`<< /Length ${rgZ.length} /Length1 ${rg.length} /Filter /FlateDecode >>`, rgZ));
  put(stream(`<< /Type /XObject /Subtype /Image /Width ${logo.W} /Height ${logo.H} /ColorSpace /DeviceGray /BitsPerComponent 8 /SMask 12 0 R /Filter /FlateDecode /Length ${grayZ.length} >>`, grayZ));
  put(stream(`<< /Type /XObject /Subtype /Image /Width ${logo.W} /Height ${logo.H} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaZ.length} >>`, alphaZ));

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
