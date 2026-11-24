import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DepositStep, type DepositBody } from "@/components/booking/deposit-step";

vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.reject(new Error("no network"))),
);
afterEach(() => {
  delete window.Stripe;
  // jsdom never loads Stripe.js: fail a load left pending, so the module drops it and the next test starts fresh.
  document.querySelectorAll<HTMLScriptElement>('script[src*="js.stripe.com"]').forEach((s) => {
    s.onerror?.(new Event("error"));
    s.remove();
  });
});

const body: DepositBody = {
  slug: "portraits",
  start: "2026-12-01T18:00:00Z",
  timeZone: "America/Los_Angeles",
  name: "Ana",
  email: "ana@example.com",
  phone: "+14085550100",
};
const rows: [string, string][] = [
  ["Session", "Portraits"],
  ["Deposit today", "$250"],
];
/* The V3 stepper's shell, drawn plain. */
const shell = (p: { head: string; sub?: string; body: React.ReactNode; bar: React.ReactNode }) => (
  <div>
    <h2>{p.head}</h2>
    {p.body}
    {p.bar}
  </div>
);

describe("DepositStep", () => {
  it("says so when Stripe fails to start", async () => {
    window.Stripe = () => {
      throw new Error("bad key");
    };
    render(<DepositStep skin="v3" shell={shell} body={body} rows={rows} onBooked={() => {}} onTaken={() => {}} onBack={() => {}} />);
    expect(await screen.findByText("The payment form did not load.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit details" })).toBeTruthy();
  });

  it("draws the same end in the editorial card", async () => {
    window.Stripe = () => {
      throw new Error("bad key");
    };
    render(<DepositStep skin="editorial" body={body} rows={rows} onBooked={() => {}} onTaken={() => {}} onBack={() => {}} />);
    expect(await screen.findByText("The payment form did not load.")).toBeTruthy();
    expect(screen.getByText("Not loaded.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit details" })).toBeTruthy();
  });

  it("shows the bill and holds Pay while the card fields load", () => {
    // Stripe.js never arrives in jsdom (no script loading): the stage stays loading.
    const onBack = vi.fn();
    render(<DepositStep skin="v3" shell={shell} body={body} rows={rows} onBooked={() => {}} onTaken={() => {}} onBack={onBack} />);
    expect(screen.getByRole("region", { name: "Deposit" })).toBeTruthy();
    expect(screen.getByText("Portraits")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Pay $250 deposit" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
  });
});
