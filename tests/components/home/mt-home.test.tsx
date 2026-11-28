import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/lib/leads/enquiry-action", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.reject(new Error("offline"))),
);

import { Home } from "@/components/home/home";
import { BOOK_ROWS, QUOTE_OPTS } from "@/lib/home/data";
import { HOME_DATA } from "@/lib/home/server";

/* The v4 home with the site's real content: every screen mounts, in order, with the picks it is given. */
describe("v4 home", () => {
  it("renders every screen once, in page order", () => {
    render(<Home data={HOME_DATA} />);
    const names = [...document.querySelectorAll("[data-mt]")].map((s) => s.getAttribute("data-mt"));
    expect(names).toEqual(["hero", "about", "comm", "quote", "motion", "book", "covers", "foot"]);
    expect(document.querySelectorAll("h1").length).toBe(1);
  });

  it("shows the picks: covers, films, sessions and quote options", () => {
    render(<Home data={HOME_DATA} />);
    expect(document.querySelectorAll(".mt-covers a.mt-cv-sleeve").length).toBe(4);
    expect(document.querySelectorAll("[data-film]").length).toBe(HOME_DATA.films.length);
    for (const r of BOOK_ROWS) expect(screen.getAllByText(r.name).length).toBeGreaterThan(0);
    for (const o of QUOTE_OPTS.slice(0, 3)) expect(screen.getAllByText(o.name).length).toBeGreaterThan(0);
  });

  it("ds: the new order, the gallery after Commissions, Weddings off the list", () => {
    document.documentElement.dataset.ds = "";
    try {
      render(<Home data={HOME_DATA} />);
      const names = [...document.querySelectorAll("[data-mt]")].map((s) => s.getAttribute("data-mt"));
      expect(names).toEqual(["hero", "about", "comm", "book", "motion", "covers", "quote", "foot"]);
      expect(document.querySelector("[data-mt=comm]")!.nextElementSibling!.className).toBe("ds-gal");
      expect(HOME_DATA.gallery.length).toBe(11);
      expect(HOME_DATA.heroDark.length).toBe(HOME_DATA.hero.length);
      expect([...document.querySelectorAll(".mt-ask-row b")].map((b) => b.textContent)).toEqual(["Commercial", "Music", "Fashion"]);
    } finally {
      delete document.documentElement.dataset.ds;
    }
  });
});
