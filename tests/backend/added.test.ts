import { describe, expect, it } from "vitest";
import { ADDED, HIDDEN, ORDER, SLUGS, instagramHandle, isTextRef } from "@/lib/added";

/* The projects /admin added (`lib/added.ts`): the handle rule and the
   invariants of the parsed `content/projects.json`. */

describe("instagramHandle", () => {
  it("stores a pasted handle, @handle or profile URL the same way", () => {
    expect(instagramHandle("rice666s")).toBe("rice666s");
    expect(instagramHandle("  @Rice666s ")).toBe("rice666s");
    expect(instagramHandle("https://www.instagram.com/rice666s/?hl=en")).toBe("rice666s");  });

  it("refuses anything outside Instagram's alphabet or opening with a dot", () => {
    expect(instagramHandle("javascript:alert(1)")).toBeNull();
    expect(instagramHandle("..")).toBeNull();
    expect(instagramHandle(".hidden")).toBeNull();
    expect(instagramHandle("")).toBeNull();
    expect(instagramHandle("a".repeat(31))).toBeNull();
    expect(instagramHandle("a".repeat(30))).toBe("a".repeat(30));
  });
});

describe("isTextRef", () => {
  it("tells a text block from a path or a frame", () => {
    expect(isTextRef({ kind: "text", heading: null, body: "x" })).toBe(true);
    expect(isTextRef("/work/a/01.jpg")).toBe(false);
    expect(isTextRef({ src: "/work/a/01.jpg" } as never)).toBe(false);
  });
});

describe("content/projects.json", () => {
  it("gives every added project a unique slug and at least one frame", () => {
    const slugs = ADDED.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of ADDED) expect(p.images.length).toBeGreaterThan(0);
  });

  it("keeps the running order and the hidden set free of repeats and blanks", () => {
    expect(new Set(ORDER).size).toBe(ORDER.length);
    for (const s of [...ORDER, ...HIDDEN]) expect(s.trim()).not.toBe("");
  });

  it("never renames a slug to itself", () => {
    for (const [from, to] of Object.entries(SLUGS)) expect(from).not.toBe(to);
  });
});
