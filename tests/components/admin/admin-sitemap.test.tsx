import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminSitemap } from "@/components/admin/admin-sitemap";

const props = {
  projects: [{ slug: "valgur", name: "VALGUR", category: "Editorial", cover: { src: "/work/v.jpg", color: "#000" } }],
  hidden: new Set<string>(),
  categories: [{ slug: "editorial", name: "Editorial", href: "/portfolio/editorial", branch: "/portfolio" }],
  origin: "https://juliangigola.com",
};

describe("AdminSitemap", () => {
  it("renders the heading and the project", () => {
    render(<AdminSitemap {...props} />);
    expect(screen.getByRole("heading", { name: "Sitemap" })).toBeTruthy();
    expect(screen.getAllByText("VALGUR").length).toBeGreaterThan(0);
  });

  it("filters and clears", () => {
    render(<AdminSitemap {...props} />);
    fireEvent.change(screen.getByLabelText("Filter the sitemap"), { target: { value: "nomatch" } });
    expect(screen.queryByText("VALGUR")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getAllByText("VALGUR").length).toBeGreaterThan(0);
  });

  it("sends a target when a row is a control", () => {
    const onGo = vi.fn();
    render(<AdminSitemap {...props} onGo={onGo} />);
    fireEvent.click(screen.getAllByText("VALGUR")[0]);
    expect(onGo).toHaveBeenCalledWith({ kind: "project", slug: "valgur" });
  });
});
