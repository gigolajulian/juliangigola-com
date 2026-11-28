import { describe, expect, it } from "vitest";
import { withListDraft, withProjectOverride } from "@/components/admin/editor/draft";
import type { ListDraft, Overrides } from "@/components/admin/editor/props";

/* The editor's setters for the per-project override maps and the list draft. */

const none: Overrides = { categories: {}, frames: {}, credits: {}, copy: {}, slugs: {}, spreads: {} };
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

describe("withListDraft", () => {
  const empty: ListDraft = { hidden: new Set(), unlisted: new Set(), bts: {} };

  it("adds a slug to a set and takes it out again, leaving the rest alone", () => {
    const hid = withListDraft(empty, "hidden", "a", true);
    expect([...hid.hidden]).toEqual(["a"]);
    expect(hid.unlisted).toBe(empty.unlisted);
    expect(empty.hidden.size).toBe(0);
    expect([...withListDraft(hid, "hidden", "a", false).hidden]).toEqual([]);
    expect([...withListDraft(empty, "unlisted", "b", true).unlisted]).toEqual(["b"]);
  });

  it("sets a BTS, and an empty one drops the entry", () => {
    const set = withListDraft(empty, "bts", "a", { by: "@crew", frames: [] });
    expect(set.bts).toEqual({ a: { by: "@crew", frames: [] } });
    expect(withListDraft(set, "bts", "a", { by: null, frames: [] }).bts).toEqual({});
    expect(withListDraft(set, "bts", "a", { by: "", frames: [] }).bts).toEqual({});
  });
});
