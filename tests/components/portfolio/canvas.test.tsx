import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkCanvas } from "@/components/portfolio/canvas";
import type { WorkItem } from "@/components/portfolio/work-tiles";
import { PROJECTS, categoryLabel } from "@/lib/work/work";

const list: WorkItem[] = PROJECTS.slice(0, 8).map((p) => ({
  slug: p.slug,
  name: p.name,
  disciplines: p.categories.map(categoryLabel),
  credits: "",
  cover: p.cover.src,
}));

describe("WorkCanvas", () => {
  it("goes back on Esc", () => {
    const onClose = vi.fn();
    render(<WorkCanvas list={list} onClose={onClose} onLeave={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Portfolio canvas" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
