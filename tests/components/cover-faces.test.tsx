import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoverFaces, coverLabel } from "@/components/cover-faces";
import type { CoverFrame } from "@/lib/cover-art-types";

const f = (src: string, side: string | null): CoverFrame => ({ src, width: 800, height: 800, color: "#000", alt: `${src} alt`, thumb: src, side });

describe("CoverFaces", () => {
  it("mounts both sides of a sleeve", () => {
    render(<CoverFaces frames={[f("/a.jpg", "Side A"), f("/b.jpg", "Side B")]} sizes="50vw" />);
    expect(screen.getByAltText("/a.jpg alt").getAttribute("data-frame")).toBe("/a.jpg");
    expect(screen.getByAltText("/b.jpg alt")).toBeTruthy();
  });

  it("renders nothing without a frame", () => {
    const { container } = render(<CoverFaces frames={[]} sizes="50vw" />);
    expect(container.innerHTML).toBe("");
  });

  it("coverLabel names the sides", () => {
    expect(coverLabel("Nyx", "Ana", [f("/a.jpg", "Side A"), f("/b.jpg", "Side B")])).toBe("Nyx by Ana, side a and side b");
    expect(coverLabel("Nyx", "Ana", [f("/a.jpg", null)])).toBe("Nyx by Ana");
  });
});
