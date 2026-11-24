import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectView } from "@/components/portfolio/project";
import { PROJECTS } from "@/lib/work/work";

describe("ProjectView", () => {
  it("renders a real project with its credits and the next link", () => {
    const project = PROJECTS.find((p) => p.credits.length && p.images.length > 3)!;
    const next = PROJECTS.find((p) => p !== project)!;
    const { container } = render(
      <ProjectView project={project} next={{ href: `/portfolio/${next.slug}`, name: `Next: ${next.name}`, cover: next.images[0] }} />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Credits" })).toBeTruthy();
    expect(container.querySelector(`a[href="/portfolio/${next.slug}"]`)).toBeTruthy();
    expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(project.images.length);
  });
});
