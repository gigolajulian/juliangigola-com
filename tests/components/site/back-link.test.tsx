import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackLink, NavMemo } from "@/components/site/back-link";
import { lastPopAt, walk } from "@/lib/nav-memo";

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

  it("NavMemo's memo hears Back and Forward", () => {
    render(<NavMemo />);
    const before = Date.now();
    dispatchEvent(new PopStateEvent("popstate"));
    expect(lastPopAt()).toBeGreaterThanOrEqual(before);
  });

  it("browser Back to the page the visit began on leaves no site page behind it", () => {
    // land on a project, click to the portfolio, browser Back
    let [pages, at] = walk(["/portfolio/iris"], 0, "/portfolio", false);
    expect(at).toBe(1);
    [pages, at] = walk(pages, at, "/portfolio/iris", true);
    expect(at).toBe(0); // was 2 when every change counted as a step, and Back left the site
    // Forward again, then a new link from the first page drops what was ahead
    [pages, at] = walk(pages, at, "/portfolio", true);
    expect(at).toBe(1);
    expect(walk(pages, 0, "/legal", false)).toEqual([["/portfolio/iris", "/legal"], 1]);
    // an entry from before this document is not counted
    expect(walk(pages, 0, "/somewhere", true)[1]).toBe(0);
  });
});
