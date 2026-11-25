import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { coverHref, HomeCovers } from "@/components/home/rows";
import { COVER_KEYS } from "@/lib/home/data";

/* The home's Cover art row (`components/home/rows.tsx`): every sleeve is a
   link to the Cover art page, which opens that cover in its viewer. */

describe("HomeCovers", () => {
  it("shows the first four picks, each linked to its place on the Cover art page", () => {
    const { container } = render(<HomeCovers />);
    const links = [...container.querySelectorAll<HTMLAnchorElement>("a.mt-cv-sleeve")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(COVER_KEYS.slice(0, 4).map(coverHref));
    expect(coverHref(COVER_KEYS[0])).toBe(`/portfolio/coverart?cover=${COVER_KEYS[0]}`);
  });
});
