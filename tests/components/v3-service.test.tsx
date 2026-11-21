import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/leads/enquiry-action", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

import { V3Service } from "@/components/v3/service";
import { BOOKING_PAGES } from "@/lib/booking/service-pages";
import { PROJECTS } from "@/lib/work/work";

describe("V3Service", () => {
  it("renders a booking page with its gallery link", () => {
    const page = BOOKING_PAGES.find((p) => p.slug === "headshots")!;
    const frames = PROJECTS.slice(0, 6).map((p) => p.cover);
    const { container } = render(<V3Service page={page} frames={frames} />);
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: page.gallery.label })).toBeTruthy();
    // headshots shows its whole gallery here; its old address redirects back, so no button to itself
    expect(screen.queryByRole("link", { name: "See the gallery" })).toBeNull();
    expect(container.querySelectorAll(".sv-seq figure")).toHaveLength(6);
  });

  it("links to a gallery that lives on its own page", () => {
    const page = BOOKING_PAGES.find((p) => p.slug === "weddings")!;
    render(<V3Service page={page} frames={PROJECTS.slice(0, 6).map((p) => p.cover)} />);
    expect(screen.getByRole("link", { name: "See the gallery" }).getAttribute("href")).toBe(page.gallery.href);
  });
});
