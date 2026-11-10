import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { CardTilt } from "@/components/card-tilt";

const fine = (on: boolean) =>
  vi
    .spyOn(window, "matchMedia")
    .mockImplementation((q: string) => ({ matches: on, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);

afterEach(() => vi.restoreAllMocks());

function card() {
  const el = document.createElement("div");
  el.className = "light-cell";
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
  document.body.append(el);
  return el;
}

describe("CardTilt", () => {
  it("renders nothing", () => {
    const { container } = render(<CardTilt />);
    expect(container.innerHTML).toBe("");
  });

  it("tips the card under a mouse and lets go on unmount", () => {
    fine(true);
    const el = card();
    const { unmount } = render(<CardTilt />);
    fireEvent.pointerMove(el, { pointerType: "mouse", clientX: 100, clientY: 50 });
    expect(el.style.getPropertyValue("--ry")).toBe("5.00deg");
    unmount();
    expect(el.style.getPropertyValue("--ry")).toBe("");
    el.remove();
  });

  it("does nothing without a fine pointer", () => {
    fine(false);
    const el = card();
    render(<CardTilt />);
    fireEvent.pointerMove(el, { pointerType: "mouse", clientX: 100, clientY: 50 });
    expect(el.style.getPropertyValue("--ry")).toBe("");
    el.remove();
  });
});
