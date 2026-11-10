import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LeadWindow, openFrom } from "@/components/lead-window";
import type { IndexRow } from "@/lib/work";

const cover = (n: number) =>
  ({ slug: `s${n}`, name: `Set ${n}`, credit: "Editorial", cover: { src: `/work/s${n}/01.jpg`, width: 800, height: 1000, color: "#111", alt: "" } }) as IndexRow;

describe("LeadWindow", () => {
  it("is a link to the portfolio showing the first three covers", () => {
    render(<LeadWindow covers={[1, 2, 3, 4].map(cover)} />);
    const link = screen.getByRole("link", { name: "Portfolio" });
    expect(link.getAttribute("href")).toBe("/portfolio");
    expect(link.textContent).toContain("Set 3");
    expect(link.textContent).not.toContain("Set 4");
    fireEvent.click(link);
    expect(document.documentElement.dataset.navSide).toBe("open");
  });

  it("openFrom sets where the flight starts", () => {
    const el = document.createElement("a");
    el.style.setProperty("--lead-pull", "100px");
    openFrom(el);
    expect(document.documentElement.style.getPropertyValue("--lead-from")).toBe(`${Math.max(0, window.innerWidth - 100)}px`);
  });
});
