import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoverNav, MotionGate, NAV, FootLine, SiteFooter, SiteHeader } from "@/components/site/chrome";

describe("chrome", () => {
  it("NAV lists the four pages", () => {
    expect(NAV.map((n) => n.href)).toEqual(["/portfolio", "/about", "/contact", "/book"]);
  });

  it("MotionGate shows the fallback without data-v3motion", () => {
    render(<MotionGate fallback={<span>still</span>}><span>moving</span></MotionGate>);
    expect(screen.getByText("still")).toBeTruthy();
    expect(screen.queryByText("moving")).toBeNull();
  });

  it("CoverNav links every page", () => {
    render(<CoverNav />);
    const nav = screen.getByRole("navigation", { name: "Cover" });
    for (const n of NAV) expect(nav.querySelector(`a[href="${n.href}"]`)?.textContent).toBe(n.label);
  });

  it("FootLine has the legal link", () => {
    render(<FootLine />);
    expect(screen.getByRole("link", { name: "Legal" }).getAttribute("href")).toBe("/legal");
    expect(screen.getByText("© 2026 Julian Gigola")).toBeTruthy();
  });

  it("SiteFooter stays out on the homepage, which has its own", () => {
    const { container } = render(<SiteFooter />);
    expect(container.innerHTML).toBe("");
  });

  it("SiteHeader renders on the homepage", () => {
    const { container } = render(<SiteHeader />);
    expect(container.querySelector("header")).toBeTruthy();
  });
});
