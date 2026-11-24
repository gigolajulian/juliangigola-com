import { describe, expect, it } from "vitest";
// Relative imports: the coverage scanner resolves `@/` under src/, which this repo does not have.
import { remapSlugs } from "../../../components/admin/editor/remap-slugs";
import type { Draft } from "../../../lib/admin/publish";

/* A rename carried through on publish: every slug-keyed override moves to
   the new slug, lists are rewritten in place, and a second run moves nothing. */

const draft = (o: Partial<Draft> = {}): Draft =>
  ({
    hidden: ["old", "keep"],
    unlisted: ["old"],
    categories: { old: ["portraits"], keep: ["events"] },
    frames: { old: [{ src: "/work/old/1.jpg" }] },
    credits: { old: [{ role: "Model", name: "Ana" }] },
    copy: { old: { title: "Old" } },
    bts: {},
    order: ["keep", "old"],
    ...o,
  }) as unknown as Draft;

describe("remapSlugs", () => {
  it("hands the same draft back when nothing is renamed", () => {
    const d = draft();
    expect(remapSlugs(d, {})).toBe(d);
    expect(remapSlugs(d, { keep: "keep" })).toBe(d);
  });

  it("moves every override and list entry under the new slug, order kept", () => {
    const out = remapSlugs(draft(), { old: "new" });
    expect(out.hidden).toEqual(["new", "keep"]);
    expect(out.unlisted).toEqual(["new"]);
    expect(out.order).toEqual(["keep", "new"]);
    expect(out.categories).toEqual({ keep: ["events"], new: ["portraits"] });
    expect(Object.keys(out.frames)).toEqual(["new"]);
    expect(Object.keys(out.credits)).toEqual(["new"]);
    expect(Object.keys(out.copy)).toEqual(["new"]);
  });

  it("never overwrites an override the new slug already has", () => {
    const out = remapSlugs(draft({ copy: { old: { title: "Old" }, new: { title: "New" } } as never }), { old: "new" });
    expect(out.copy).toEqual({ old: { title: "Old" }, new: { title: "New" } });
  });

  it("is idempotent: run again after the rename, nothing moves", () => {
    const once = remapSlugs(draft(), { old: "new" });
    expect(remapSlugs(once, { old: "new" })).toEqual(once);
  });

  it("leaves the draft it was given untouched", () => {
    const d = draft();
    remapSlugs(d, { old: "new" });
    expect(d.hidden).toEqual(["old", "keep"]);
    expect(Object.keys(d.frames)).toEqual(["old"]);
  });
});
