/* One colour per project for the portfolio rail (Julian, 2026-10-05: colours
 * from my photos in the scrollbar, tastefully). Read off `public/scope.json`:
 * the project's samples ranked by chroma, counting only what sits in the
 * light, and the one at the 90th percentile taken, so a single stray pixel
 * does not set it. The cover art is not in the samples, so each of
 * `public/covers/` is read here, keyed by its file. Written to
 * `lib/accents.json`, keyed by slug. Run by
 * `make-scope.mts` after it writes the samples. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const oklab = (r, g, b) => {
  [r, g, b] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122 * r + 0.5363 * g + 0.0514 * b);
  const m = Math.cbrt(0.2119 * r + 0.6807 * g + 0.1074 * b);
  const s = Math.cbrt(0.0883 * r + 0.2817 * g + 0.63 * b);
  return [
    0.2105 * l + 0.7936 * m - 0.0041 * s,
    1.978 * l - 2.4286 * m + 0.4506 * s,
    0.0259 * l + 0.7828 * m - 0.8087 * s,
  ];
};
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

const scope = JSON.parse(readFileSync("public/scope.json", "utf8"));
for (const f of readdirSync("public/covers").filter((f) => /\.jpe?g$/i.test(f) && !/-800\./.test(f))) {
  const { data } = await sharp(`public/covers/${f}`).resize(12, 15, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  scope[f] = [["", 0, 0, "", "", ...data]];
}
const out = {};
for (const [slug, entries] of Object.entries(scope)) {
  const pts = [];
  for (const [, , , , , ...px] of entries)
    for (let i = 0; i + 2 < px.length; i += 3) {
      const [L, a, b] = oklab(px[i], px[i + 1], px[i + 2]);
      pts.push([Math.hypot(a, b) * Math.min(1, L / 0.4), px.slice(i, i + 3)]);
    }
  if (!pts.length) continue;
  pts.sort((x, y) => x[0] - y[0]);
  out[slug] = hex(pts[Math.floor(pts.length * 0.9)][1]);
}
writeFileSync("lib/accents.json", JSON.stringify(out, null, 1) + "\n");
console.log(Object.keys(out).length, "accents");
