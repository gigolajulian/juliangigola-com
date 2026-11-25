import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimePicker } from "@/components/booking/picker/time-picker";

afterEach(() => vi.unstubAllGlobals());

describe("TimePicker", () => {
  it("holds a labelled card while the times load", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<TimePicker path="julian/portraits-a" title="Pick a time" fallback={<p>Email me</p>} />);
    expect(screen.getByLabelText("Pick a time")).toBeTruthy();
  });

  it("falls back when the times cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "error" }))),
    );
    render(<TimePicker path="julian/portraits-b" title="Pick a time" fallback={<p>Email me</p>} />);
    expect(await screen.findByText("Email me")).toBeTruthy();
  });

  it("heads the month Monday first, as the stepper's calendar", async () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const answer = { title: "Portraits", length: 60, where: true, slots: { [day]: [`${day}T10:00:00-08:00`] } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(answer))),
    );
    const { container } = render(<TimePicker path="julian/portraits-c" title="Pick a time" fallback={<p>Email me</p>} />);
    await vi.waitFor(() => expect(container.querySelector(".ed-mhead")).toBeTruthy(), { timeout: 5000 });
    expect([...container.querySelectorAll(".ed-mhead span")].map((x) => x.textContent)).toEqual([
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
      "SUN",
    ]);
  });
});
