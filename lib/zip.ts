/* ── a stored zip, streamed ──────────────────────────────────────
 * "Download all" on a delivery (Julian 2026-11-12). JPEGs do not shrink,
 * so entries are stored, never deflated, and every size and CRC is known
 * before the first byte: the headers are built up front, the archive's
 * length is exact, and the Worker only pipes each file's bytes from R2.
 * Zip64 fields appear only where a size or offset passes 4 GB.
 * ─────────────────────────────────────────────────────────────── */

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 carried across chunks: start with 0, pass the last result back in. */
export function crc32(bytes: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

export type ZipEntry = { name: string; size: number; crc: number };

const MAX32 = 0xffffffff;

class Out {
  private b: number[] = [];
  u16(v: number) { this.b.push(v & 0xff, (v >>> 8) & 0xff); return this; }
  u32(v: number) { for (let i = 0; i < 4; i++) this.b.push(Math.floor(v / 2 ** (8 * i)) & 0xff); return this; }
  u64(v: number) { return this.u32(v % 2 ** 32).u32(Math.floor(v / 2 ** 32)); }
  raw(a: Uint8Array) { for (const x of a) this.b.push(x); return this; }
  done() { return Uint8Array.from(this.b); }
}

/** Headers for each entry and the closing directory. `lim` is 4 GB; tests pass a small one to reach the zip64 paths. */
export function zipLayout(entries: ZipEntry[], when = new Date(), lim = MAX32) {
  const enc = new TextEncoder();
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const date = ((Math.max(1980, when.getFullYear()) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const locals: Uint8Array[] = [];
  const central = new Out();
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const big = e.size >= lim, far = offset >= lim;
    const local = new Out().u32(0x04034b50).u16(big ? 45 : 20).u16(0x0800).u16(0).u16(time).u16(date).u32(e.crc)
      .u32(big ? MAX32 : e.size).u32(big ? MAX32 : e.size).u16(name.length).u16(big ? 20 : 0).raw(name);
    if (big) local.u16(1).u16(16).u64(e.size).u64(e.size);
    const head = local.done();
    locals.push(head);
    const extra = (big ? 16 : 0) + (far ? 8 : 0);
    central.u32(0x02014b50).u16(45).u16(big || far ? 45 : 20).u16(0x0800).u16(0).u16(time).u16(date).u32(e.crc)
      .u32(big ? MAX32 : e.size).u32(big ? MAX32 : e.size).u16(name.length).u16(extra ? extra + 4 : 0).u16(0).u16(0).u16(0).u32(0)
      .u32(far ? MAX32 : offset).raw(name);
    if (extra) {
      central.u16(1).u16(extra);
      if (big) central.u64(e.size).u64(e.size);
      if (far) central.u64(offset);
    }
    offset += head.length + e.size;
  }
  const dir = central.done();
  const n = entries.length, wide = n >= 0xffff || offset >= lim || dir.length >= lim;
  const end = new Out();
  if (wide) {
    end.u32(0x06064b50).u64(44).u16(45).u16(45).u32(0).u32(0).u64(n).u64(n).u64(dir.length).u64(offset);
    end.u32(0x07064b50).u32(0).u64(offset + dir.length).u32(1);
  }
  end.u32(0x06054b50).u16(0).u16(0).u16(wide ? 0xffff : n).u16(wide ? 0xffff : n).u32(wide ? MAX32 : dir.length).u32(wide ? MAX32 : offset).u16(0);
  const tail = new Uint8Array(dir.length + end.done().length);
  tail.set(dir);
  tail.set(end.done(), dir.length);
  return { locals, tail, total: offset + tail.length };
}

/** Names unique inside the archive: a second "IMG_1.jpg" becomes "IMG_1 (2).jpg". */
export function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.map((raw) => {
    const n = raw.replace(/[\\/]/g, "_") || "photo.jpg";
    let out = n;
    for (let i = 2; seen.has(out.toLowerCase()); i++) out = n.replace(/(\.[^.]*)?$/, (ext) => ` (${i})${ext}`);
    seen.add(out.toLowerCase());
    return out;
  });
}
