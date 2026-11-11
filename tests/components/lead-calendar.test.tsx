import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LeadCalendar } from "@/components/leads/lead-calendar";

afterEach(() => vi.unstubAllGlobals());

describe("LeadCalendar", () => {
  it("loads the month and adds a calendar", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ events: [], busy: [], extras: [] }), { status: 200 })));
    vi.stubGlobal("fetch", fetch);
    const onBack = vi.fn();
    render(<LeadCalendar onBack={onBack} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("Calendar");
    expect(screen.getByText("Loading the calendar")).toBeTruthy();
    await vi.waitFor(() => expect(screen.queryByText("Loading the calendar")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /More/ }));
    expect(onBack).toHaveBeenCalled();

    const [name] = screen.getAllByLabelText("Calendar name");
    const [src] = screen.getAllByLabelText("Google calendar id or ICS link");
    fireEvent.change(name, { target: { value: "iCloud" } });
    fireEvent.change(src, { target: { value: "https://x.test/a.ics" } });
    fireEvent.submit(name.closest("form")!);
    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/calendar",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ extra: { label: "iCloud", src: "https://x.test/a.ics" } }) }),
      ),
    );
  });

  it("shows the error when the calendar does not answer", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: "Not authorized." }), { status: 401 }))));
    render(<LeadCalendar />);
    expect((await screen.findByRole("alert")).textContent).toBe("Not authorized.");
  });
});
