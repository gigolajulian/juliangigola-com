import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { V3Project } from "@/components/v3/project";
import { PROJECTS } from "@/lib/work";

describe("V3Project", () => {
  it("renders a real project with its credits and the next link", () => {
    const project = PROJECTS.find((p) => p.credits.length && p.images.length > 3)!;
    const next = PROJECTS.find((p) => p !== project)!;
    const { container } = render(<V3Project project={project} next={{ href: `/portfolio/${next.slug}`, name: `Next: ${next.name}`, cover: next.images[0] }} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Credits" })).toBeTruthy();
    expect(container.querySelector(`a[href="/portfolio/${next.slug}"]`)).toBeTruthy();
    expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(project.images.length);
  });
});
