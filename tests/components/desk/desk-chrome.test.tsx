import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { glyph } from "@/components/desk/chrome";

describe("glyph", () => {
  it("draws its path in a 24 box, hidden from screen readers, with props passed through", () => {
    const Plus = glyph(<path d="M12 5v14" />);
    const { container } = render(<Plus className="x" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("class")).toBe("x");
    expect(svg.querySelector("path")?.getAttribute("d")).toBe("M12 5v14");
  });
});
