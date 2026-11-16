import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ManageBooking, type Managed } from "@/components/booking/manage-booking";

// The picker fetches times on its own; it is not what is under test here.
vi.mock("@/components/booking/time-picker", () => ({ TimePicker: () => <p>picker</p> }));

afterEach(() => vi.unstubAllGlobals());

const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString();
const booking: Managed = { id: "b1", slug: "portraits", session: "Portraits", start: inDays(5), end: inDays(5), firstStart: undefined, where: undefined, moves: 0, fee: undefined, paid: true, deposit: undefined, cancelled: false };

describe("ManageBooking", () => {
  it("cancels with the refund spelled out first", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ record: { ...booking, cancelled: true }, refunded: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetch);
    render(<ManageBooking booking={booking} token="t" />);
    expect(screen.getByRole("heading", { name: "Portraits" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(/48 hours or more before your session/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(await screen.findByText(/deposit is on its way back/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Book another time" }).getAttribute("href")).toBe("/book");
    expect(fetch).toHaveBeenCalledWith("/api/booking/b1", expect.objectContaining({ method: "POST" }));
  });

  it("30 hours out: says 70% goes back before the cancel, and what the server sent after", async () => {
    const soon: Managed = { ...booking, start: new Date(Date.now() + 30 * 36e5).toISOString(), deposit: 200 };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ record: { ...soon, cancelled: true }, refunded: true, back: 140 }), { status: 200 }))));
    render(<ManageBooking booking={soon} token="t" open="cancel" />);
    expect(screen.getByText(/\$140 of your \$200 deposit is refunded to your card and \$60 is kept/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(await screen.findByText(/\$140 of your \$200 deposit is on its way back/)).toBeTruthy();
  });

  it("a booking with the fee: 90% back a week out, and no Reschedule inside the last day", () => {
    const { unmount } = render(<ManageBooking booking={{ ...booking, fee: 10, deposit: 250 }} token="t" open="cancel" />);
    expect(screen.getByText(/\$225 of your \$250 deposit is refunded to your card\. \$25 is kept as the booking fee/)).toBeTruthy();
    unmount();
    render(<ManageBooking booking={{ ...booking, start: new Date(Date.now() + 10 * 36e5).toISOString() }} token="t" open="reschedule" />);
    expect(screen.queryByText("picker")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reschedule" })).toBeNull();
    expect(screen.getByText(/under 24 hours before your session, so it can no longer be moved/)).toBeTruthy();
  });

  it("opens the picker from the reschedule link", () => {
    render(<ManageBooking booking={booking} token="t" open="reschedule" />);
    expect(screen.getByText("picker")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeTruthy();
  });

  it("says a started session can no longer change", () => {
    render(<ManageBooking booking={{ ...booking, start: inDays(-1) }} token="t" />);
    expect(screen.getByText(/This session has started/)).toBeTruthy();
  });
});
