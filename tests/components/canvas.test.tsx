import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { V3Canvas } from "@/components/portfolio/canvas";
import type { WorkItem } from "@/components/portfolio/work";
import { PROJECTS, categoryLabel } from "@/lib/work/work";

const list: WorkItem[] = PROJECTS.slice(0, 8).map((p) => ({ s: p.slug, n: p.name, d: p.categories.map(categoryLabel), c: "", cover: p.cover.src }));

describe("V3Canvas", () => {
  it("goes back on Esc", () => {
    const onClose = vi.fn();
    render(<V3Canvas list={list} onClose={onClose} onLeave={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Portfolio canvas" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
