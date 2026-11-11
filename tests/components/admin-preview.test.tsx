import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminPreview } from "@/components/admin/admin-preview";
import type { SiteContent } from "@/lib/content";

const draft = {
  responseTime: "within a day",
  bookingUrl: null,
  featured: ["ghost"],
  sessions: [{ slug: "portraits", name: "Portraits", from: null }],
  testimonials: [],
} as unknown as SiteContent;

describe("AdminPreview", () => {
  it("names missing slugs and summarises the draft", () => {
    render(<AdminPreview draft={draft} projects={[]} hidden={new Set()} />);
    expect(screen.getByText(/No project called "ghost"/)).toBeTruthy();
    expect(screen.getByText("Sessions: 1")).toBeTruthy();
    expect(screen.getByText("On request")).toBeTruthy();
    expect(screen.getByText(/Replies within a day\./)).toBeTruthy();
    expect(screen.getByText(/None\. The section is left out/)).toBeTruthy();
  });
});
