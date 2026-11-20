import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// The site's patch to liquid-gooey (`patches/README.md`). Fails when an
// install skipped `patch-package`, or the package moved off the version
// the patch was written for.
const require = createRequire(import.meta.url);
// The package exports only its entry, which is in `dist`.
const dir = dirname(require.resolve("liquid-gooey"));

describe("liquid-gooey patch", () => {
  it("is on the version the patch was written for", () => {
    const pkg = JSON.parse(readFileSync(join(dir, "..", "package.json"), "utf8"));
    expect(pkg.version).toBe("0.2.2");
  });

  for (const file of ["index.js", "index.cjs"]) {
    it(`is applied to dist/${file}`, () => {
      const src = readFileSync(join(dir, file), "utf8");
      // Paused while scrolling, and not run off screen.
      expect(src).toContain("this.scrolling = 0;");
      expect(src).toContain("this.visible = true;");
      expect(src).toContain("new IntersectionObserver(");
    });
  }
});
