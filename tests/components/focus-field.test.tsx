import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FocusField } from "@/components/focus-field";

describe("FocusField", () => {
  it("lays its one hidden layer and cleans up", () => {
    const { container, unmount } = render(<FocusField />);
    const el = container.querySelector(".focus-field")!;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(() => unmount()).not.toThrow();
  });
});
