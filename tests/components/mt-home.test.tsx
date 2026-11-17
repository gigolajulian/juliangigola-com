import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/app/contact/actions", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

import { MtHome } from "@/components/v3/mt/home";
import { BOOK_ROWS, COVER_KEYS, QUOTE_OPTS } from "@/components/v3/mt/data";
import { MT } from "@/lib/mt-home-data";

/* The v4 home with the site's real content: every screen mounts, in order, with the picks it is given. */
describe("v4 home", () => {
  it("renders every screen once, in page order", () => {
    render(<MtHome data={MT} />);
    const names = [...document.querySelectorAll("[data-mt]")].map((s) => s.getAttribute("data-mt"));
    expect(names).toEqual(["hero", "comm", "covers", "motion", "book", "quote", "about", "foot"]);
    expect(document.querySelectorAll("h1").length).toBe(1);
  });

  it("shows the picks: covers, films, sessions and quote options", () => {
    render(<MtHome data={MT} />);
    expect(document.querySelectorAll(".mt-covers .mt-item").length).toBe(COVER_KEYS.length);
    expect(document.querySelectorAll("[data-film]").length).toBe(MT.films.length);
    for (const r of BOOK_ROWS) expect(screen.getAllByText(r.name).length).toBeGreaterThan(0);
    for (const o of QUOTE_OPTS.slice(0, 3)) expect(screen.getAllByText(o.name).length).toBeGreaterThan(0);
  });
});
