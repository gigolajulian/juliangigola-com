import { describe, expect, it } from "vitest";
import { srcOf } from "@/lib/admin/admin-sequence";

/* The one pure export of /admin's sequence editor (`lib/admin/admin-sequence.ts`);
   `useSequence` is a React hook and is not covered here. */

describe("srcOf", () => {
  it("gives a path for a path or a frame, and nothing for a passage", () => {
    expect(srcOf("/work/a/01.jpg")).toBe("/work/a/01.jpg");
    expect(srcOf({ src: "/work/a/02.jpg", width: 1, height: 1, alt: "", color: "#000" } as never)).toBe("/work/a/02.jpg");
    expect(srcOf({ kind: "text", heading: null, body: "words" })).toBe("");
  });
});
