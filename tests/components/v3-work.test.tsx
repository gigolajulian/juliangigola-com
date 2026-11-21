import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { V3Work, type WorkItem } from "@/components/portfolio/work";
import { PROJECTS, categoryLabel } from "@/lib/work/work";

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

  it("the canvas is a view of its own, and `?view=canvas` opens on it", () => {
    const { unmount } = render(<V3Work work={WORK} />);
    const btn = screen.getByRole("button", { name: "Canvas view" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(location.search).toBe("?view=canvas");
    unmount();
    render(<V3Work work={WORK} />);
    expect(screen.getAllByRole("button", { name: "Canvas view" })[0].getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getAllByRole("button", { name: "Grid view" })[0]);
    expect(location.search).toBe("");
  });

  it("from the canvas, the Color button lands on Color when Color is the view under it", () => {
    render(<V3Work work={WORK} />);
    const pressed = (name: string) => screen.getAllByRole("button", { name })[0].getAttribute("aria-pressed");
    const click = (name: string) => fireEvent.click(screen.getAllByRole("button", { name })[0]);
    click("Color view");
    expect(pressed("Color view")).toBe("true");
    click("Canvas view");
    expect(pressed("Canvas view")).toBe("true");
    expect(pressed("Color view")).toBe("false");
    click("Color view");
    expect(pressed("Canvas view")).toBe("false");
    expect(pressed("Color view")).toBe("true");
    // Off again goes back to the view Color was opened from.
    click("Color view");
    expect(pressed("Grid view")).toBe("true");
  });
});
