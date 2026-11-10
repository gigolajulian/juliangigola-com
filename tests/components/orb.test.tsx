import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ORB_ROUND, Orb } from "@/components/orb";

describe("Orb", () => {
  it("holds its size and stays hidden from readers until the ink is read", () => {
    // setup.ts stubs canvas getContext to null, so the orb itself never draws.
    const { container } = render(<Orb size={32} />);
    const span = container.querySelector("span")!;
    expect(span.getAttribute("aria-hidden")).toBe("true");
    expect(span.style.width).toBe("32px");
    expect(span.childElementCount).toBe(0);
  });

  it("rounds include the 300ms wait to show", () => {
    for (const ms of Object.values(ORB_ROUND)) expect(ms).toBeGreaterThan(300);
  });
});
