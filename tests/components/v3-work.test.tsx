import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { V3Work, type WorkItem } from "@/components/v3/work";
import { PROJECTS, categoryLabel } from "@/lib/work";

const WORK: WorkItem[] = PROJECTS.filter((p) => p.slug !== "realestate").map((p) => ({
  s: p.slug,
  n: p.name,
  d: p.categories.map(categoryLabel),
  c: p.credits.map((c) => (c.handle ? `@${c.handle}` : c.name)).join(" "),
  cover: p.cover.src,
}));

describe("V3Work", () => {
  it("links every project in the grid", () => {
    const { container } = render(<V3Work work={WORK} />);
    for (const w of WORK.slice(0, 5)) expect(container.querySelector(`a[href="/portfolio/${w.s}"]`)).toBeTruthy();
    expect(screen.getByRole("group", { name: "View" })).toBeTruthy();
  });

  it("a discipline chip narrows the grid", () => {
    const { container } = render(<V3Work work={WORK} />);
    const d = WORK[0].d[0];
    const group = screen.getByRole("group", { name: "Filter by discipline" });
    const chip = [...group.querySelectorAll("button")].find((b) => b.textContent?.startsWith(d))!;
    fireEvent.click(chip);
    const outside = WORK.find((w) => !w.d.includes(d));
    if (outside) expect(container.querySelector(`.wgrid a[href="/portfolio/${outside.s}"]`)).toBeNull();
  });
});
