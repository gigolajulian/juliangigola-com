import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ManageBooking, type Managed } from "@/components/manage-booking";

// The picker fetches times on its own; it is not what is under test here.
vi.mock("@/components/time-picker", () => ({ TimePicker: () => <p>picker</p> }));

afterEach(() => vi.unstubAllGlobals());

const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString();
const booking: Managed = { id: "b1", slug: "portraits", session: "Portraits", start: inDays(5), end: inDays(5), paid: true, cancelled: false };

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
