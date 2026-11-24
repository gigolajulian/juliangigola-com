import { describe, expect, it } from "vitest";
import { coverLabel } from "@/components/cover/cover-art-gallery";
import type { CoverFrame } from "@/lib/work/cover-art-types";

const f = (src: string, side: string | null): CoverFrame => ({ src, width: 800, height: 800, color: "#000", alt: `${src} alt`, thumb: src, side });

describe("coverLabel", () => {
  it("names the sides", () => {
    expect(coverLabel("Nyx", "Ana", [f("/a.jpg", "Side A"), f("/b.jpg", "Side B")])).toBe("Nyx by Ana, side a and side b");
    expect(coverLabel("Nyx", "Ana", [f("/a.jpg", null)])).toBe("Nyx by Ana");
  });
});
