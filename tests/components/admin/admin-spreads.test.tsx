import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AdminSpreads } from "@/components/admin/admin-spreads";

const photos = Array.from({ length: 7 }, (_, i) => `/work/x/0${i + 1}.jpg`);

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.ds;
});

describe("AdminSpreads", () => {
  it("is not there without the preview flag", () => {
    const { container } = render(<AdminSpreads slug="x" photos={photos} value="pfr" onChange={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("ds: shows the blocks with every frame once, and a pressed block writes a code that covers the frames", () => {
    document.documentElement.dataset.ds = "";
    const onChange = vi.fn();
    render(<AdminSpreads slug="x" photos={photos} value="pfr" onChange={onChange} />);
    expect(screen.getAllByRole("img").map((i) => i.getAttribute("alt"))).toEqual(photos.map((_, i) => `Frame ${i + 1}`));
    expect(screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(["Block 1, frames 2, 3", "Block 2, frames 4", "Block 3, frames 5, 6, 7"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Row" })[0]);
    expect(onChange).toHaveBeenCalledWith("rfp");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
