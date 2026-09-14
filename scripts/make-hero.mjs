/**
 * Sizes the cover's hand-made frames for phones, and makes their blur-ups.
 *
 * Every photograph on the site is meant to be resized by Cloudflare Image
 * Transformations, and until those are switched on the loader hands every
 * device the original file. For the archive that is a cost; for the cover it
 * is the first thing a visitor sees: `/hero/intro.jpg` is 730kB at 2456x3070,
 * and on a phone that is seconds of the frame's flat placeholder colour
 * before the picture pops in — "phase00 on mobile looks horrible".
 *
 * So the four files in `public/hero/` — the only frames the site draws by
 * hand rather than harvests — get three sized copies each, which the loader
 * serves by width (see `image-loader.ts`), and a 16px blur-up each, which the
 * cover paints under the picture while it loads (see `hero.tsx`). Twelve
 * small files and one JSON, all committed: the script is for regenerating
 * them when a frame changes, and runs on every build so it cannot go stale.
 *
 * This must never fail a build. Anything wrong logs a
 * warning and exits 0 with whatever is already on disk.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "public/hero";
/** The widths the loader knows about; keep the two lists in step. */
const WIDTHS = [640, 1080, 1920];
const BLUR_WIDTH = 16;

const base = (file) => /^[a-z0-9-]+\.jpg$/i.test(file) && !/-w\d+\.jpg$/i.test(file);
const fresh = (source, target) => {
  try {
    return statSync(target).mtimeMs >= statSync(source).mtimeMs;
  } catch {
    return false;
  }
};

try {
  const { default: sharp } = await import("sharp");
  const blur = {};
  let made = 0;

  for (const file of readdirSync(DIR).filter(base)) {
    const source = join(DIR, file);
    const name = file.replace(/\.jpg$/i, "");

    for (const w of WIDTHS) {
      const target = join(DIR, `${name}-w${w}.jpg`);
      if (fresh(source, target)) continue;
      await sharp(source)
        .resize({ width: w, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(target);
      made += 1;
    }

    // The blur-up: a 16px JPEG, which the browser scales up and softens.
    // Under a kilobyte each, inlined as a data URL so it paints with the
    // HTML rather than after a request.
    const tiny = await sharp(source)
      .resize({ width: BLUR_WIDTH })
      .jpeg({ quality: 50 })
      .toBuffer();
    blur[`/hero/${file}`] = `data:image/jpeg;base64,${tiny.toString("base64")}`;
  }

  const out = join(DIR, "blur.json");
  const json = JSON.stringify(blur, null, 2) + "\n";
  let changed = true;
  try {
    changed = readFileSync(out, "utf8") !== json;
  } catch {}
  if (changed) writeFileSync(out, json);

  console.log(
    `make-hero: ${made} sized frame${made === 1 ? "" : "s"} written, blur-ups for ${Object.keys(blur).length} frames${changed ? " (blur.json updated)" : ""}`,
  );
} catch (e) {
  console.warn(`make-hero: skipped — ${e instanceof Error ? e.message : e}`);
}
