import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ScrollReveal } from "@/components/v3/scroll-reveal";

describe("ScrollReveal", () => {
  it("mounts and unmounts without output", () => {
    const { container, unmount } = render(<ScrollReveal />);
    expect(container.innerHTML).toBe("");
    unmount();
  });
});
