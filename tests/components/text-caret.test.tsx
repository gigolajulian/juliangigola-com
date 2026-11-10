import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TextCaret } from "@/components/text-caret";

describe("TextCaret", () => {
  it("renders a hidden caret and stays off without a fine pointer", () => {
    const { container } = render(<TextCaret />);
    const caret = container.querySelector(".text-caret")!;
    expect(caret.getAttribute("aria-hidden")).toBe("true");
    expect(caret.hasAttribute("data-on")).toBe(false);
  });
});
