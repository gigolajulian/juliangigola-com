import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackLink, NavMemo } from "@/components/site/back-link";

describe("BackLink", () => {
  it("links to the portfolio when opened directly", () => {
    render(<BackLink className="x" />);
    const link = screen.getByRole("link", { name: /back/i });
    expect(link.getAttribute("href")).toBe("/portfolio");
    expect(link.className).toBe("x");
  });

  it("NavMemo renders nothing", () => {
    const { container } = render(<NavMemo />);
    expect(container.innerHTML).toBe("");
  });
});
