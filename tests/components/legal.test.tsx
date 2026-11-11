import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Clause, LegalColumn, V3LegalPage } from "@/components/site/legal";

describe("V3LegalPage", () => {
  it("lays out each document with its contents and anchored clauses", async () => {
    render(
      <V3LegalPage>
        <LegalColumn id="terms" title="Terms of use" label="Terms" effective="2026-10-01">
          <Clause title="Ownership">All photos are mine.</Clause>
          <Clause title="What you may do">Look.</Clause>
        </LegalColumn>
      </V3LegalPage>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Legal" })).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 2, name: "Terms of use" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /What you may do/ }).getAttribute("href")).toBe("#terms-what-you-may-do");
    expect(document.getElementById("terms-ownership")?.textContent).toContain("All photos are mine.");
    expect(screen.getByText("October 1, 2026")).toBeTruthy();
  });

  it("Clause and LegalColumn draw nothing on their own", () => {
    const { container } = render(
      <LegalColumn id="x" title="X" label="X" effective="2026-01-01">
        <Clause title="A">a</Clause>
      </LegalColumn>,
    );
    expect(container.innerHTML).toBe("");
  });
});
