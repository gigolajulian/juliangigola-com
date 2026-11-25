import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { MotionGate, NAV, FootLine, SiteFooter, SiteHeader } from "@/components/site/chrome";

describe("chrome", () => {
  it("NAV lists the four pages", () => {
    expect(NAV.map((n) => n.href)).toEqual(["/portfolio", "/about", "/contact", "/book"]);
  });

  it("MotionGate renders the fallback on the server and its children on the client", () => {
    const gate = (
      <MotionGate fallback={<span>still</span>}>
        <span>moving</span>
      </MotionGate>
    );
    expect(renderToString(gate)).toBe("<span>still</span>");
    render(gate);
    expect(screen.getByText("moving")).toBeTruthy();
    expect(screen.queryByText("still")).toBeNull();
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
