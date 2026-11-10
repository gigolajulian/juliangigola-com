import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { GlassLight } from "@/components/glass-light";

afterEach(() => vi.restoreAllMocks());

describe("GlassLight", () => {
  it("renders nothing", () => {
    const { container } = render(<GlassLight />);
    expect(container.innerHTML).toBe("");
  });

  it("writes where the pointer is on the glass", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ matches: true, media: q }) as unknown as MediaQueryList);
    const el = document.createElement("div");
    el.className = "glass";
    el.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 40 }) as DOMRect;
    document.body.append(el);
    render(<GlassLight />);
    fireEvent.pointerMove(el, { clientX: 30, clientY: 25 });
    expect(el.style.getPropertyValue("--gx")).toBe("20px");
    expect(el.style.getPropertyValue("--gy")).toBe("5px");
    el.remove();
  });
});
