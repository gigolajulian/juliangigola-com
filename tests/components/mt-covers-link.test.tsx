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

  it("loads the first three sleeves with the page and leaves the rest lazy", () => {
    const { container } = render(<MtCovers />);
    const faces = [...container.querySelectorAll<HTMLImageElement>(".face img:not(.back)")];
    expect(faces.map((im) => im.getAttribute("loading"))).toEqual(faces.map((_, i) => (i < 3 ? "eager" : "lazy")));
    expect(faces.slice(0, 3).every((im) => im.getAttribute("fetchpriority") === "high")).toBe(true);
    expect(faces.slice(3).some((im) => im.hasAttribute("fetchpriority"))).toBe(false);
  });
});
