import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DepositStep, type DepositBody } from "@/components/deposit-step";

vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("no network"))));
afterEach(() => {
  delete window.Stripe;
});

const body: DepositBody = {
  slug: "portraits",
  start: "2026-12-01T18:00:00Z",
  timeZone: "America/Los_Angeles",
  name: "Ana",
  email: "ana@example.com",
  phone: "+14085550100",
  engine: "own",
};
const rows: [string, string][] = [
  ["Session", "Portraits"],
  ["Deposit today", "$100"],
];

describe("DepositStep", () => {
  // Stripe.js loads once per module: the failing start goes first, since a pending load is kept.
  it("says so when Stripe fails to start", async () => {
    window.Stripe = () => {
      throw new Error("bad key");
    };
    render(<DepositStep body={body} rows={rows} onBooked={() => {}} onTaken={() => {}} onBack={() => {}} />);
    expect(await screen.findByText("The payment form did not load.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("shows the bill and holds Pay while the card fields load", () => {
    // Stripe.js never arrives in jsdom (no script loading): the stage stays loading.
    const onBack = vi.fn();
    render(<DepositStep body={body} rows={rows} onBooked={() => {}} onTaken={() => {}} onBack={onBack} />);
    expect(screen.getByRole("region", { name: "Deposit" })).toBeTruthy();
    expect(screen.getByText("Portraits")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Pay $100 deposit" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    expect(onBack).toHaveBeenCalled();
  });
});
