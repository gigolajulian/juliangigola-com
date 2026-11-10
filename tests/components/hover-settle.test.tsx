import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { HoverSettle } from "@/components/hover-settle";

afterEach(() => vi.useRealTimers());

describe("HoverSettle", () => {
  it("arms data-hover 600ms after mount", () => {
    vi.useFakeTimers();
    const root = document.documentElement;
    root.setAttribute("data-hover", "");
    const { container } = render(<HoverSettle />);
    expect(container.innerHTML).toBe("");
    expect(root.hasAttribute("data-hover")).toBe(false);
    act(() => vi.advanceTimersByTime(600));
    expect(root.hasAttribute("data-hover")).toBe(true);
    root.removeAttribute("data-hover");
  });
});
