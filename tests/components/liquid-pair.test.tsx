/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors stand in for the links the component wraps */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiquidPair } from "@/components/liquid-pair";

describe("LiquidPair", () => {
  it("renders plain buttons without a mouse", () => {
    const { container } = render(
      <LiquidPair className="pair">
        <a href="/book">Book a session</a>
        <a href="/portfolio" className="btn-quiet">See the work</a>
      </LiquidPair>,
    );
    expect(container.firstElementChild!.className).toBe("pair");
    expect(screen.getByRole("link", { name: "Book a session" }).getAttribute("href")).toBe("/book");
    expect(screen.getByRole("link", { name: "See the work" })).toBeTruthy();
  });
});
