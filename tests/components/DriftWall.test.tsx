import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DriftWall from "@/components/DriftWall";

beforeAll(() => {
  // jsdom has no Web Animations API.
  Element.prototype.animate = vi.fn(() => ({
    pause() {},
    play() {},
    cancel() {},
    updatePlaybackRate() {},
    currentTime: 0,
    playState: "paused",
    effect: { getComputedTiming: () => ({ progress: 0 }) },
  })) as never;
});

describe("DriftWall", () => {
  it("renders a labelled group of tiles", () => {
    render(
      <DriftWall
        columns={2}
        eager
        items={[
          { image: "/a.jpg", title: "Alpha", href: "/work/a" },
          { image: "/b.jpg", title: "Beta", href: "https://example.com" },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Drifting wall of tiles" })).toBeTruthy();
    const imgs = screen.getAllByAltText("Alpha");
    expect(imgs[0].getAttribute("src")).toBe("/a.jpg");
    const outside = screen.getAllByAltText("Beta")[0].closest("a")!;
    expect(outside.getAttribute("target")).toBe("_blank");
    expect(outside.getAttribute("data-ring")).toBe("Open");
    expect(screen.getAllByAltText("Alpha")[0].closest("a")!.getAttribute("data-ring")).toBe("View");
  });

  it("uses buttons for tiles without a link", () => {
    render(<DriftWall columns={1} items={[{ image: "/c.jpg", title: "Gamma" }]} />);
    expect(screen.getAllByRole("button", { name: "Gamma" }).length).toBeGreaterThan(0);
  });
});
