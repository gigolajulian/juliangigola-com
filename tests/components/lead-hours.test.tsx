import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LeadHours } from "@/components/lead-hours";
import { DEFAULT_HOURS } from "@/lib/booking-rules";

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

afterEach(() => vi.unstubAllGlobals());

describe("LeadHours", () => {
  it("loads the week, then saves an edit", async () => {
    const fetch = vi.fn(() => ok({ hours: DEFAULT_HOURS }));
    vi.stubGlobal("fetch", fetch);
    render(<LeadHours />);
    expect(screen.getByText("Loading hours")).toBeTruthy();
    expect(await screen.findByText("Every week, Pacific")).toBeTruthy();
    const save = screen.getByRole("button", { name: "Save hours" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    // Monday is closed in the defaults: opening it marks the hours unsaved.
    fireEvent.click(screen.getAllByRole("checkbox")[5]);
    expect(screen.getByRole("status").textContent).toBe("Not saved");
    fireEvent.click(save);
    expect(await screen.findByText("Saved. The booking page uses it now.")).toBeTruthy();
    expect(fetch).toHaveBeenLastCalledWith("/api/booking/hours", expect.objectContaining({ method: "PUT" }));
  });

  it("says so when the hours cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: "Nope" }), { status: 401 }))));
    render(<LeadHours />);
    expect(await screen.findByText("Nope")).toBeTruthy();
  });
});
