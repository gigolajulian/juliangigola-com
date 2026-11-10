import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegalPage } from "@/components/legal";
import { TermsColumn } from "@/components/terms";

describe("TermsColumn", () => {
  it("renders without throwing outside the legal page", () => {
    expect(() => render(<TermsColumn />)).not.toThrow();
  });

  it("shelves its clauses for the legal page", async () => {
    render(
      <LegalPage>
        <TermsColumn />
      </LegalPage>,
    );
    expect((await screen.findAllByText("Definitions")).length).toBeGreaterThan(0);
  });
});
