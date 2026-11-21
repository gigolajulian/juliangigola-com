import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { coverHref, MtCovers } from "@/components/v4/home/rows";
import { COVER_KEYS } from "@/lib/v4-home/data";

/* The home's Cover art row (`components/v4/home/rows.tsx`): every sleeve is a
   link to the Cover art page, which opens that cover in its viewer. */

describe("MtCovers", () => {
  it("links each cover to its place on the Cover art page", () => {
    const { container } = render(<MtCovers />);
    const links = [...container.querySelectorAll<HTMLAnchorElement>("a.mt-sleeve")];
    expect(links.length).toBe(COVER_KEYS.length);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(COVER_KEYS.map(coverHref));
    expect(coverHref(COVER_KEYS[0])).toBe(`/portfolio/coverart?cover=${COVER_KEYS[0]}`);
  });
});
