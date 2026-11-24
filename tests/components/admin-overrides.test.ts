import { describe, expect, it } from "vitest";
import { withProjectOverride } from "@/components/admin/editor/draft";
import type { Overrides } from "@/components/admin/admin-editor-props";

/* The editor's one setter for the per-project override maps. */

const none: Overrides = { categories: {}, frames: {}, credits: {}, copy: {}, slugs: {} };
const published: Overrides = { ...none, frames: { a: ["/work/a/02.jpg", "/work/a/01.jpg"] } };

describe("withProjectOverride", () => {
  it("sets one project's entry and leaves the other maps alone", () => {
    const o = withProjectOverride(none, "categories", "a", "editorial", published);
    expect(o).toEqual({ ...none, categories: { a: "editorial" } });
  });

  it("null puts frames back to what is published, or drops the entry where nothing is", () => {
    const edited = withProjectOverride(none, "frames", "a", ["/work/a/01.jpg"], published);
    expect(withProjectOverride(edited, "frames", "a", null, published).frames).toEqual(published.frames);
    const b = withProjectOverride(none, "frames", "b", ["/work/b/01.jpg"], published);
    expect(withProjectOverride(b, "frames", "b", null, published).frames).toEqual({});
  });

  it("a slug renamed back to its original is no rename", () => {
    const renamed = withProjectOverride(none, "slugs", "a", "a-new", published);
    expect(renamed.slugs).toEqual({ a: "a-new" });
    expect(withProjectOverride(renamed, "slugs", "a", "a", published).slugs).toEqual({});
  });
});
