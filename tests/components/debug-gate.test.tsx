import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DebugGate } from "@/components/debug-gate";

afterEach(() => history.replaceState(null, "", "/"));

describe("DebugGate", () => {
  it("renders nothing without ?debug", () => {
    const { container } = render(<DebugGate />);
    expect(container.innerHTML).toBe("");
  });

  it("loads the overlay with ?debug", async () => {
    history.replaceState(null, "", "/?debug");
    render(<DebugGate />);
    expect(await screen.findByRole("button", { name: "Copy log" })).toBeTruthy();
  });
});
