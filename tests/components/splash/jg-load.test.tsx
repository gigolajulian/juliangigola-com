import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { JgLoad } from "@/components/splash/jg-load";

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

  it("finishes when the frames run behind performance.now() and the times come late", async () => {
    // jsdom's frames lag performance.now(); this lag once left the count on 99.99999999999999 for good
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now() - 700), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
    try {
      const onDone = vi.fn();
      const { rerender } = render(<JgLoad done={false} onDone={onDone} />);
      await new Promise((go) => setTimeout(go, 80));
      rerender(<JgLoad done onDone={onDone} />);
      await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1), { timeout: 2000 });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
