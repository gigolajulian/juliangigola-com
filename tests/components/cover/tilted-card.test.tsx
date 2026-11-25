import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";

// gsap stands in with a quickTo that lands at once, so the test reads where each move ends.
const quickTo = vi.fn(
  (target: Record<string, number>, key: string, vars: { duration: number; ease: string; onUpdate: () => void }) => (v: number) => {
    target[key] = v;
    vars.onUpdate();
  },
);
vi.mock("@/lib/motion/gsap-lazy", () => ({
  loadGsap: () => Promise.resolve({ quickTo, killTweensOf: vi.fn() }),
}));

const { default: TiltedCard } = await import("@/components/vendor/tilted-card");

function setup() {
  const { container } = render(
    <TiltedCard containerHeight="100%" imageHeight="100%" imageWidth="100%" scaleOnHover={1.04}>
      <span>photo</span>
    </TiltedCard>,
  );
  const figure = container.querySelector("figure")!;
  const inner = container.querySelector<HTMLElement>(".tilted-card-inner")!;
  figure.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON() {} });
  return { figure, inner };
}

describe("TiltedCard", () => {
  it("tilts toward the pointer and grows on gsap, in the order the motion spring wrote", async () => {
    const { figure, inner } = setup();
    expect(inner.style.transform).toBe("");
    await act(async () => {
      fireEvent.mouseEnter(figure);
    });
    await act(async () => {
      fireEvent.mouseMove(figure, { clientX: 200, clientY: 0 });
    });
    expect(inner.style.transform).toBe("scale(1.04) rotateX(14deg) rotateY(14deg)");
    expect(quickTo).toHaveBeenCalledWith(expect.anything(), "rx", expect.objectContaining({ duration: 1.2, ease: "power2.out" }));
  });

  it("settles flat and unscaled when the pointer leaves", async () => {
    const { figure, inner } = setup();
    await act(async () => {
      fireEvent.mouseEnter(figure);
      fireEvent.mouseMove(figure, { clientX: 50, clientY: 75 });
    });
    await act(async () => {
      fireEvent.mouseLeave(figure);
    });
    expect(inner.style.transform).toBe("none");
  });

  it("holds still under Reduce Motion: the stylesheet beats the inline transform", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("app/styles/motion-plan.css", "utf8");
    expect(css).toMatch(/\.tilted-card-inner[^{]*\{\s*transform: none !important;/);
  });
});
