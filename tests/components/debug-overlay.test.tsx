import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DebugOverlay } from "@/components/debug-overlay";

describe("DebugOverlay", () => {
  it("shows the fps line and its buttons", () => {
    const { container } = render(<DebugOverlay />);
    expect(container.querySelector("[data-debug-overlay]")).toBeTruthy();
    expect(screen.getByText("- fps")).toBeTruthy();
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Clear" }))).not.toThrow();
  });

  it("copies the log to the clipboard", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<DebugOverlay />);
    fireEvent.click(screen.getByRole("button", { name: "Copy log" }));
    expect(await screen.findByText("copied")).toBeTruthy();
    expect((writeText.mock.calls[0] as unknown as [string])[0]).toContain(location.href);
  });
});
