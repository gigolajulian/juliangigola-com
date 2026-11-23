import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoIndex } from "@/components/portfolio/video";
import { CONTENT } from "@/lib/content";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLMediaElement.prototype.play = () => Promise.resolve();
HTMLMediaElement.prototype.pause = () => {};

const videos = CONTENT.videos;

describe("VideoIndex", () => {
  it("renders the film count heading and a play button per film", () => {
    render(<VideoIndex videos={videos} />);
    expect(screen.getAllByRole("heading", { level: 1 })[0].textContent).toMatch(/^Motion · \d+ films$/);
    expect(screen.getAllByRole("button", { name: /^Play / }).length).toBeGreaterThan(0);
  });
});
