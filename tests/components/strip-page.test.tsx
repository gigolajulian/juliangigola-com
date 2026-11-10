/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors stand in for the links the component wraps */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RisingTitle, StripHead, StripPage, longestWord, titleWidth } from "@/components/strip-page";

describe("StripPage", () => {
  it("wraps the head and the strip in a quiet-footer article", () => {
    const { container } = render(
      <StripPage head={<p>head</p>}>
        <p>strip</p>
      </StripPage>,
    );
    expect(container.querySelector("article[data-quiet-footer]")).toBeTruthy();
    expect(screen.getByText("strip")).toBeTruthy();
  });
});

describe("RisingTitle", () => {
  it("splits the words and can be the page h1", () => {
    render(<RisingTitle text="Book a session" as="h1" />);
    expect(screen.getByRole("heading", { level: 1, name: "Book a session" })).toBeTruthy();
    expect(document.querySelectorAll(".title-word")).toHaveLength(3);
  });
});

describe("StripHead", () => {
  it("shows crumb, title and sub", () => {
    render(<StripHead crumb={<a href="/portfolio">All work</a>} title="Editorial" sub="For Diesel" />);
    expect(screen.getByRole("heading", { name: "Editorial" })).toBeTruthy();
    expect(screen.getByText("For Diesel")).toBeTruthy();
    expect(screen.getByRole("link", { name: "All work" }).getAttribute("href")).toBe("/portfolio");
  });

  it("the title is a filter button on a phone", () => {
    const onPick = vi.fn();
    render(<StripHead crumb={null} title="Portraits" pick={{ count: 4, expanded: false, controls: "f", onPick }} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onPick).toHaveBeenCalled();
  });
});

describe("width helpers", () => {
  it("measure in ems", () => {
    expect(longestWord("A AUTOMOTIVE")).toBeCloseTo(7.6);
    expect(titleWidth("AB CD")).toBeCloseTo(4 * 0.76 + 0.3);
  });
});
