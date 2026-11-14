import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { V3Canvas } from "@/components/v3/canvas";
import type { WorkItem } from "@/components/v3/work";
import { PROJECTS, categoryLabel } from "@/lib/work";

const list: WorkItem[] = PROJECTS.slice(0, 8).map((p) => ({ s: p.slug, n: p.name, d: p.categories.map(categoryLabel), c: "", cover: p.cover.src }));

describe("V3Canvas", () => {
  it("carries the view's bar and goes back on Esc", () => {
    const onClose = vi.fn();
    render(<V3Canvas list={list} onClose={onClose} onLeave={vi.fn()} bar={<button type="button">Grid view</button>} />);
    const dlg = screen.getByRole("dialog", { name: "Portfolio canvas" });
    expect(dlg.querySelector(".cv-top button")?.textContent).toBe("Grid view");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
