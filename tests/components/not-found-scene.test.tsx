import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlinkingMark, NotFoundScene, blink } from "@/components/not-found-scene";

describe("NotFoundScene", () => {
  it("fills in the path and locks focus without a fine pointer", () => {
    render(
      <NotFoundScene>
        <h1 data-numerals>404</h1>
        <p data-focus-readout>...</p>
        <p data-requested-path>...</p>
      </NotFoundScene>,
    );
    expect(screen.getByRole("heading", { name: "404" })).toBeTruthy();
    expect(screen.getByText("FOCUS LOCKED")).toBeTruthy();
    expect(document.querySelector("[data-requested-path]")?.textContent).toBe("/");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("BlinkingMark", () => {
  it("draws the lids inside an svg", () => {
    const { container } = render(<BlinkingMark className="m" still />);
    expect(container.querySelector("svg.m [data-lids]")).toBeTruthy();
  });

  it("blink animates the lids for 240ms", () => {
    const animate = vi.fn();
    blink({ animate } as unknown as Element);
    expect(animate).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ duration: 240 }));
  });
});
