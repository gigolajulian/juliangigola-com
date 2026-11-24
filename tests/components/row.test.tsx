import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { About, joinParts, Next } from "@/components/leads/row";
import { lead } from "./leads-fixtures";

describe("row", () => {
  it("joins only the parts there are", () => {
    expect(joinParts(["Consultation", null, "", "Call booked", undefined, false])).toBe("Consultation · Call booked");
    render(<About>{joinParts(["Portraits", "Quoted"])}</About>);
    expect(screen.getByText("Portraits · Quoted")).toBeTruthy();
  });

  it("puts stuck money ahead of the next step", () => {
    render(<Next l={lead("a", { flags: ["stuck"] } as never)} />);
    expect(screen.getByText(/Deposit stuck/)).toBeTruthy();
    expect(screen.queryByText(/Refund or rebook/)).toBeNull();
  });

  it("shows Reply on a fresh inquiry", () => {
    render(<Next l={lead("a")} />);
    expect(screen.getByText("Reply →")).toBeTruthy();
  });
});
