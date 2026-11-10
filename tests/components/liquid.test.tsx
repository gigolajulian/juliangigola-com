import { describe, expect, it } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { Liquid, useQuiet } from "@/components/liquid";

describe("liquid", () => {
  it("Liquid mounts with an item", () => {
    render(
      <Liquid fill="black">
        <Liquid.Item>
          <button type="button">Go</button>
        </Liquid.Item>
      </Liquid>,
    );
    expect(screen.getByRole("button", { name: "Go" })).toBeTruthy();
  });

  it("useQuiet turns true once the page goes quiet", async () => {
    const { result } = renderHook(() => useQuiet());
    await waitFor(() => expect(result.current).toBe(true), { timeout: 2500 });
  });
});
