import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Galleries } from "@/components/leads/galleries";
import type { ProofRow } from "@/lib/proofs/proof-desk";
import { iso } from "./leads-fixtures";

describe("Galleries", () => {
  const proof = (extra: Partial<ProofRow>) => ({ token: "t1", name: "Ana portraits", frames: Array(48).fill({}), selects: [], url: "/p/t1", ...extra }) as unknown as ProofRow;

  it("says where each gallery stands and who it went to", () => {
    const open = vi.fn();
    render(<Galleries lead="ana@x.com" open={open} galleries={[
      proof({ token: "t1", views: 3 }),
      proof({ token: "t2", name: "Ana finals", deliveredAt: iso, finals: [{}, {}] as never, email: "ad@studio.com" }),
    ]} />);
    expect(screen.getByText("Proofs · 48 frames · not sent · opened 3 times")).toBeTruthy();
    expect(screen.getByText(/^Finals · 2 photos · delivered .* · to ad@studio.com$/)).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByText("Delivered")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Open" })[1]);
    expect(open).toHaveBeenCalledWith("t2");
    fireEvent.click(screen.getByRole("button", { name: "All proofs" }));
    expect(open).toHaveBeenLastCalledWith();
  });
});
