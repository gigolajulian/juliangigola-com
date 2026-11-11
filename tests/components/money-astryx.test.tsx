import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MoneyAstryx } from "@/components/leads/money-astryx";

afterEach(() => vi.unstubAllGlobals());

const txn = (id: string, what: string) => ({ id, at: new Date().toISOString(), type: "charge", amount: 10000, fee: 320, net: 9680, currency: "usd", status: "available", what });

describe("MoneyAstryx", () => {
  it("shows the balance and pages the transactions with Show more", async () => {
    const fetch = vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.includes("after=t1") ? { txns: [txn("t2", "Iris deposit")], more: false } : { available: 124000, pending: 31000, txns: [txn("t1", "Mara deposit")], more: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<MoneyAstryx />);
    expect(await screen.findByText("$1,240.00")).toBeTruthy();
    expect(screen.getByText("Mara deposit")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(screen.getByText("Iris deposit")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});
