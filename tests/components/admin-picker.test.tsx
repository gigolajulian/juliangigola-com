import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminPicker } from "@/components/admin/admin-picker";

const items = [
  { slug: "a", name: "Alpha", detail: "Editorial", cover: { src: "/work/a.jpg", color: "#000" } },
  { slug: "b", name: "Beta", detail: "Portraits", cover: { src: "/work/b.jpg", color: "#000" } },
];
const base = { addLabel: "Add a project", searchLabel: "Search projects", emptyNote: "Nothing chosen." };

describe("AdminPicker", () => {
  it("shows the empty note and adds a pick", () => {
    const onChange = vi.fn();
    render(<AdminPicker {...base} chosen={[]} items={items} onChange={onChange} />);
    expect(screen.getByText("Nothing chosen.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add a project" }));
    expect(screen.getByPlaceholderText("Search projects")).toBeTruthy();
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("flags unknown slugs and removes a pick", () => {
    const onChange = vi.fn();
    render(<AdminPicker {...base} chosen={["a", "zz"]} items={items} onChange={onChange} />);
    expect(screen.getByText("nothing with this slug, will be skipped")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Remove Alpha"));
    expect(onChange).toHaveBeenCalledWith(["zz"]);
  });
});
