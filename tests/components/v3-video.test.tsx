import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Mob, V3Video } from "@/components/v3/video";
import { CONTENT } from "@/lib/content";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLMediaElement.prototype.play = () => Promise.resolve();
HTMLMediaElement.prototype.pause = () => {};

const videos = CONTENT.videos;

describe("V3Video", () => {
  it("renders the film count heading and a play button per film", () => {
    render(<V3Video videos={videos} />);
    expect(screen.getAllByRole("heading", { level: 1 })[0].textContent).toMatch(/^Motion · \d+ films$/);
    expect(screen.getAllByRole("button", { name: /^Play / }).length).toBeGreaterThan(0);
  });
});

describe("Mob", () => {
  it("plays the reel and filters by section", () => {
    const onPlay = vi.fn();
    render(<Mob videos={videos} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole("button", { name: "Play with sound" }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    const group = screen.getByRole("group", { name: "Filter films" });
    const tabs = group.querySelectorAll("button");
    fireEvent.click(tabs[1]);
    expect(tabs[1].getAttribute("aria-pressed")).toBe("true");
    expect(tabs[0].getAttribute("aria-pressed")).toBe("false");
  });
});
