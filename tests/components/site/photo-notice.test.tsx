/* eslint-disable @next/next/no-img-element -- a plain img is the fixture */
import { beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoNotice } from "@/components/photo-notice";

beforeAll(() => {
  // jsdom has no Web Animations.
  Element.prototype.animate = (() => ({ cancel() {}, onfinish: null })) as never;
});

describe("PhotoNotice", () => {
  it("starts hidden", () => {
    render(<PhotoNotice />);
    expect(document.querySelector<HTMLElement>("[role=status]")!.style.visibility).toBe("hidden");
  });

  it("a double right click on a photo says who owns it", () => {
    render(
      <>
        <PhotoNotice />
        <img alt="frame" />
      </>,
    );
    const img = screen.getByAltText("frame");
    // The first click only keeps the menu shut.
    expect(fireEvent.contextMenu(img)).toBe(false);
    expect(document.querySelector<HTMLElement>("[role=status]")!.textContent).not.toMatch(/This photo/);
    fireEvent.contextMenu(img);
    expect(document.querySelector<HTMLElement>("[role=status]")!.textContent).toMatch(/This photo/);
  });
});
