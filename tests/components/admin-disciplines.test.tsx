import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminDisciplines } from "@/components/admin-disciplines";
import type { AdminProject } from "@/components/admin-projects";

const frame = { src: "/work/a/01.jpg", width: 100, height: 120, color: "#111" };
const project = (slug: string, categorySlug: string): AdminProject => ({
  slug,
  origin: slug,
  name: slug.toUpperCase(),
  category: categorySlug,
  categorySlug,
  images: [frame.src],
  frames: [frame],
  cover: frame,
  intent: null,
  title: slug,
  added: false,
  credits: [],
});

const disciplines = [
  { slug: "editorial", name: "Editorial", group: "Work" },
  { slug: "portraits", name: "Portraits", group: "Sessions" },
];

const base = {
  disciplines,
  hidden: new Set<string>(),
  onOrder: () => {},
  covers: {},
  onCover: () => {},
  opened: null,
};

describe("AdminDisciplines", () => {
  it("lists both groups and filters by project name", () => {
    render(
      <AdminDisciplines
        {...base}
        projects={[project("valgur", "editorial"), project("ana", "portraits")]}
        onOpened={() => {}}
      />,
    );
    expect(screen.getByText("Work")).toBeTruthy();
    expect(screen.getByText("Sessions")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Filter by discipline or project"), {
      target: { value: "valgur" },
    });
    expect(screen.queryByText("Sessions")).toBeNull();
  });

  it("opens a discipline from its cover", () => {
    const onOpened = vi.fn();
    render(<AdminDisciplines {...base} projects={[]} onOpened={onOpened} />);
    fireEvent.click(screen.getByTitle("Change the Editorial cover"));
    expect(onOpened).toHaveBeenCalledWith("editorial");
  });
});
