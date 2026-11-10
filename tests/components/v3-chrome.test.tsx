import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoverNav, MotionGate, NAV, V3Foot, V3Footer, V3Header } from "@/components/v3/chrome";

describe("chrome", () => {
  it("NAV lists the four pages", () => {
    expect(NAV.map((n) => n.href)).toEqual(["/portfolio", "/book", "/about", "/contact/form"]);
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

  it("V3Foot has the legal link", () => {
    render(<V3Foot />);
    expect(screen.getByRole("link", { name: "Legal" }).getAttribute("href")).toBe("/legal");
    expect(screen.getByText("© 2026 Julian Gigola")).toBeTruthy();
  });

  it("V3Footer stays out on the homepage, which has its own", () => {
    const { container } = render(<V3Footer />);
    expect(container.innerHTML).toBe("");
  });

  it("V3Header renders on the homepage", () => {
    const { container } = render(<V3Header />);
    expect(container.querySelector("header")).toBeTruthy();
  });
});
