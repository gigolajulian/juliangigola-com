import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ScrollThumb } from "@/components/v3/scroll-thumb";

describe("ScrollThumb", () => {
  it("renders a hidden thumb and marks the root while mounted", () => {
    const { container, unmount } = render(<ScrollThumb />);
    const el = container.querySelector(".sb-thumb");
    expect(el?.getAttribute("aria-hidden")).toBe("true");
    expect(document.documentElement.dataset.sb).toBe("");
    unmount();
    expect(document.documentElement.dataset.sb).toBeUndefined();
  });
});
