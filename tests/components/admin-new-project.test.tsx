import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/admin-github", () => ({
  commitFiles: vi.fn(async () => {}),
  readFile: vi.fn(async () => null),
}));

import { AdminNewProject } from "@/components/admin/admin-new-project";

const categories = [{ slug: "editorial", name: "Editorial" }];

describe("AdminNewProject", () => {
  it("renders the form with publish disabled", () => {
    render(<AdminNewProject token="t" categories={categories} existingSlugs={new Set()} />);
    expect(screen.getByRole("heading", { name: "Add a project" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Publish project" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("derives the slug from the name and flags a taken one", () => {
    render(<AdminNewProject token="t" categories={categories} existingSlugs={new Set(["luxe-meets-future"])} />);
    fireEvent.change(screen.getByPlaceholderText("Luxe Meets Future"), { target: { value: "Luxe Meets Future" } });
    expect((screen.getByPlaceholderText("luxe-meets-future") as HTMLInputElement).value).toBe("luxe-meets-future");
    expect(screen.getByText("Already used by another project.")).toBeTruthy();
  });
});
