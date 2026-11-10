import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { JgLoad } from "@/components/jg-load";

describe("JgLoad", () => {
  it("shows the wait as a status with a zero count", () => {
    render(<JgLoad done={false} onDone={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("Loading availability");
    expect(screen.getByRole("status").textContent).toContain("0");
  });

  it("calls onDone once the times are in", async () => {
    const onDone = vi.fn();
    render(<JgLoad done onDone={onDone} />);
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });
});
