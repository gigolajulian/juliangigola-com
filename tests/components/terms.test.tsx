import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { V3LegalPage } from "@/components/site/legal";
import { TermsColumn } from "@/components/site/terms";

describe("TermsColumn", () => {
  it("renders without throwing outside the legal page", () => {
    expect(() => render(<TermsColumn />)).not.toThrow();
  });

  it("shelves its clauses for the legal page", async () => {
    render(
      <V3LegalPage>
        <TermsColumn />
      </V3LegalPage>,
    );
    expect((await screen.findAllByText("Definitions")).length).toBeGreaterThan(0);
  });
});
