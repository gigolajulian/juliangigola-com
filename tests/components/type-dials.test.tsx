import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TypeDials } from "@/components/type-dials";

// jsdom has no document.fonts.
beforeAll(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: { status: "loaded", ready: Promise.resolve() } });
});

afterEach(() => {
  delete document.documentElement.dataset.font;
  document.documentElement.removeAttribute("style");
});

describe("TypeDials", () => {
  it("is off unless the page asks for font v2", () => {
    const { container } = render(<TypeDials />);
    expect(container.innerHTML).toBe("");
    expect(document.documentElement.style.getPropertyValue("--v2-title-family")).toBe("");
  });

  it("puts the default faces on the root under font v2", () => {
    document.documentElement.dataset.font = "v2";
    const { container } = render(<TypeDials />);
    expect(container.innerHTML).toBe("");
    expect(document.documentElement.style.getPropertyValue("--v2-title-family")).not.toBe("");
  });
});
