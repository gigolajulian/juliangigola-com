import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const show = vi.hoisted(() => vi.fn());
vi.mock("@/components/cover/lightbox", () => ({ useLightbox: () => ({ show }), Lightbox: () => null }));
if (!globalThis.CSS?.escape) vi.stubGlobal("CSS", { escape: (s: string) => s });

import { CoverArtGallery } from "@/components/cover/cover-art-gallery";
import type { CoverRelease } from "@/lib/work/cover-art-types";

const frame = (src: string) => ({ src, width: 800, height: 800, color: "#000", alt: "", thumb: src, side: null });
const releases: CoverRelease[] = [
  { slug: "one", title: "One", artist: "Ana", frames: [frame("/c/1.jpg")] },
  { slug: "two", title: "Two", artist: "Bo", frames: [frame("/c/2.jpg")] },
];

describe("CoverArtGallery", () => {
  it("lays out one cell per release", () => {
    render(<CoverArtGallery releases={releases} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Open One by Ana" })).toBeTruthy();
  });

  it("opens the lightbox at the release's place", () => {
    render(<CoverArtGallery releases={releases} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Two by Bo" }));
    expect(show).toHaveBeenCalledWith(1, expect.anything());
  });

  it("arrives open on the cover a home click named (?cover=)", () => {
    show.mockClear();
    history.replaceState(null, "", "/portfolio/coverart?cover=two");
    render(<CoverArtGallery releases={releases} v4 />);
    // no history entry of its own (null, false): one Back goes home (QA on #1313)
    expect(show).toHaveBeenCalledWith(1, null, false);
    history.replaceState(null, "", "/");
  });
});
