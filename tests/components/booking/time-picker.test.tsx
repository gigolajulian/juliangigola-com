import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimePicker } from "@/components/booking/time-picker";

afterEach(() => vi.unstubAllGlobals());

describe("TimePicker", () => {
  it("holds a labelled card while the times load", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<TimePicker path="julian/portraits-a" title="Pick a time" fallback={<p>Email me</p>} />);
    expect(screen.getByLabelText("Pick a time")).toBeTruthy();
  });

  it("falls back when the times cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "error" }))));
    render(<TimePicker path="julian/portraits-b" title="Pick a time" fallback={<p>Email me</p>} />);
    expect(await screen.findByText("Email me")).toBeTruthy();
  });
});
