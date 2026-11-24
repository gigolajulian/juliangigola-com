import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { About } from "@/components/about/about";

describe("About", () => {
  it("renders the heading, the CTAs and the client grid", () => {
    render(<About />);
    expect(screen.getByRole("heading", { level: 1, name: "About me" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Inquire" }).getAttribute("href")).toBe("/contact/form");
    expect(screen.getByRole("link", { name: "See the work" }).getAttribute("href")).toBe("/portfolio");
    expect(screen.getByText("Creative direction")).toBeTruthy();
    expect(screen.getByRole("img", { name: "WIRED" })).toBeTruthy();
  });
});
