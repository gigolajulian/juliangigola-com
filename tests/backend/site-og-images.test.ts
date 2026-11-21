import { describe, expect, it } from "vitest";
import * as home from "@/app/opengraph-image";
import * as about from "@/app/about/opengraph-image";
import * as book from "@/app/book/opengraph-image";
import * as bookSlug from "@/app/book/[slug]/opengraph-image";
import * as contact from "@/app/contact/opengraph-image";
import * as contactForm from "@/app/contact/form/opengraph-image";
import * as legal from "@/app/legal/opengraph-image";
import * as portfolio from "@/app/portfolio/(index)/opengraph-image";
import * as video from "@/app/portfolio/(index)/video/opengraph-image";
import * as project from "@/app/portfolio/[slug]/opengraph-image";
import * as service from "@/app/[service]/opengraph-image";
import { LINKABLE } from "@/lib/work/work";
import { BOOKING_PAGES } from "@/lib/booking/booking";
import { SESSIONS } from "@/lib/photos-and-sessions";

/* Every share card is the same 1200x630 JPEG with the site's name as its
   alt; the dynamic ones are drawn for each address the page prerenders. */
const CARDS = { home, about, book, bookSlug, contact, contactForm, legal, portfolio, video, project, service };

describe("opengraph images", () => {
  it.each(Object.entries(CARDS))("%s is a 1200x630 JPEG named for the site", (_, card) => {
    expect(card.size).toEqual({ width: 1200, height: 630 });
    expect(card.contentType).toBe("image/jpeg");
    expect(card.alt).toBe("Julian Gigola");
    expect(typeof card.default).toBe("function");
  });

  it("draws a card for every page the dynamic routes prerender", () => {
    expect(project.generateStaticParams()).toEqual(LINKABLE.map((p) => ({ slug: p.slug })));
    expect(service.generateStaticParams()).toEqual(BOOKING_PAGES.map((p) => ({ service: p.slug })));
    expect(bookSlug.generateStaticParams()).toEqual(Object.keys(SESSIONS).map((slug) => ({ slug })));
  });
});
