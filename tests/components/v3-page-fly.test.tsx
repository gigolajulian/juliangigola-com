/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors stand in for the links the component wraps */
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { PageFly } from "@/components/v3/page-fly";

describe("PageFly", () => {
  it("mounts with no output and lets a link click through without the motion flag", () => {
    const { container } = render(
      <div className="v3">
        <PageFly />
        <a href="/portfolio">Portfolio</a>
      </div>,
    );
    expect(container.querySelector(".v3")?.children).toHaveLength(1);
    expect(fireEvent.click(container.querySelector("a")!)).toBe(true);
  });
});
