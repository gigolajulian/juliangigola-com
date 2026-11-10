import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BtsClip } from "@/components/bts-clip";

beforeAll(() => {
  // jsdom has no media playback.
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});

describe("BtsClip", () => {
  it("holds on its poster until pressed", () => {
    const { container } = render(<BtsClip src="/bts/a.mp4" label="Nyx clip" />);
    const btn = screen.getByRole("button", { name: "Play Nyx clip" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    const video = container.querySelector("video")!;
    expect(video.getAttribute("poster")).toBe("/bts/a.poster.jpg");
    expect(video.getAttribute("preload")).toBe("none");
  });

  it("toggles on a key press click", () => {
    render(<BtsClip src="/bts/a.mp4" label="Nyx clip" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: "Pause Nyx clip" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: "Play Nyx clip" })).toBeTruthy();
  });
});
