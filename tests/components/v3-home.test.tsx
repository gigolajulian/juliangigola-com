import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { V3Home } from "@/components/home/rollback";
import { Doors } from "@/components/site/doors";
import { INDEX_ORDER } from "@/lib/photos-and-sessions";

describe("V3Home", () => {
  it("renders the name and every section", () => {
    render(<V3Home top={{}} />);
    expect(screen.getByRole("heading", { level: 1, name: "Julian Gigola" })).toBeTruthy();
    for (const h of ["Recent work", "Commissions", "Sessions"]) expect(screen.getByRole("heading", { name: h })).toBeTruthy();
  });

  it("Doors links each session and the inquiry", () => {
    const { container } = render(<Doors />);
    expect(screen.getByRole("link", { name: "Inquire" }).getAttribute("href")).toBe("/contact/form");
    for (const s of INDEX_ORDER) expect(container.querySelector(`a[href="/book/${s}"]`)).toBeTruthy();
  });
});
