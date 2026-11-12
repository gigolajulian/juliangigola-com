import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { V3LegalPage } from "@/components/site/legal";
import { PrivacyColumn } from "@/components/site/privacy";

describe("PrivacyColumn", () => {
  it("renders without throwing outside the legal page", () => {
    expect(() => render(<PrivacyColumn />)).not.toThrow();
  });

  it("shelves its clauses for the legal page", async () => {
    render(
      <V3LegalPage>
        <PrivacyColumn />
      </V3LegalPage>,
    );
    expect((await screen.findAllByText(/What is collected, and when/)).length).toBeGreaterThan(0);
  });
});
