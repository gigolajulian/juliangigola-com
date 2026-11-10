import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/admin-github", () => ({
  commitFiles: vi.fn(async () => {}),
  listDirectory: vi.fn(async () => []),
  readFile: vi.fn(async () => null),
}));

import { AdminTrash } from "@/components/admin-trash";
import type { TrashedProject } from "@/lib/added";

const frame = { src: "/work/x/01.jpg", width: 10, height: 10, color: "#000", alt: "" };
const item: TrashedProject = {
  slug: "x",
  name: "Project X",
  categorySlug: "editorial",
  credits: [],
  cover: frame,
  images: [frame, frame],
  deletedAt: new Date().toISOString(),
};

describe("AdminTrash", () => {
  it("renders nothing when empty", () => {
    const { container } = render(<AdminTrash token="t" trash={[]} onChanged={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("lists a project and asks before deleting", () => {
    render(<AdminTrash token="t" trash={[item]} onChanged={() => {}} />);
    expect(screen.getByRole("heading", { name: "Recently deleted" })).toBeTruthy();
    expect(screen.getByText(/2 frames · 7 days left/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
    expect(screen.getByRole("button", { name: "Really delete" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete forever" })).toBeTruthy();
  });

  it("reports a failed recover", async () => {
    render(<AdminTrash token="t" trash={[item]} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Recover" }));
    expect(await screen.findByText("Could not read the project list.")).toBeTruthy();
  });
});
