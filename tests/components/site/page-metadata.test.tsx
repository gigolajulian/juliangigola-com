import { describe, expect, it } from "vitest";
import * as project from "@/app/portfolio/[slug]/page";
import * as service from "@/app/[service]/page";
import * as book from "@/app/book/[slug]/page";
import * as campus from "@/app/graduation-photos/[campus]/page";
import { LINKABLE, UNLISTED } from "@/lib/work/work";
import { BOOK_MENU, BOOKING_PAGES } from "@/lib/booking/service-pages";
import { SESSIONS } from "@/lib/booking/catalog";
import { CAMPUS_GUIDES } from "@/lib/graduation/campus-guides";
import { SESSION_SEO } from "@/lib/og/seo";

/* The dynamic pages' static params and metadata: which addresses are
   prerendered, the canonical each one claims, and an empty answer (the
   page then 404s) for a slug that is not there. */

const params = <T,>(p: T) => ({ params: Promise.resolve(p) }) as never;

describe("/portfolio/[slug]", () => {
  it("prerenders every linkable project, unlisted ones included", () => {
    expect(project.generateStaticParams()).toEqual(LINKABLE.map((p) => ({ slug: p.slug })));
  });

  it("claims its own canonical, noindexes an unlisted one, and is empty for an unknown slug", async () => {
    for (const p of LINKABLE) {
      const m = await project.generateMetadata(params({ slug: p.slug }));
      expect(m.alternates?.canonical).toBe(p.slug === "weddings" ? "/weddings" : `/portfolio/${p.slug}`);
      expect(m.title).toBe(SESSION_SEO[p.slug]?.title ?? p.name);
      if (UNLISTED.has(p.slug)) expect(m.robots).toEqual({ index: false, follow: true });
      else expect(m.robots).toBeUndefined();
    }
    expect(await project.generateMetadata(params({ slug: "no-such-project" }))).toEqual({});
  });
});

describe("/[service]", () => {
  it("prerenders each booking page and gives it its own title and canonical", async () => {
    expect(service.generateStaticParams()).toEqual(BOOKING_PAGES.map((p) => ({ service: p.slug })));
    for (const p of BOOKING_PAGES) {
      const m = await service.generateMetadata(params({ service: p.slug }));
      expect(m).toMatchObject({ title: p.title, description: p.description, alternates: { canonical: `/${p.slug}` } });
    }
    expect(await service.generateMetadata(params({ service: "nope" }))).toEqual({});
  });
});

describe("/book/[slug]", () => {
  it("prerenders every session, titled in lowercase", async () => {
    expect(book.generateStaticParams()).toEqual(Object.keys(SESSIONS).map((slug) => ({ slug })));
    for (const slug of Object.keys(SESSIONS).filter((s) => s !== "consultation")) {
      const m = await book.generateMetadata(params({ slug }));
      const name = BOOK_MENU.find((x) => x.slug === slug)?.name ?? SESSIONS[slug as keyof typeof SESSIONS].name;
      expect(m.title).toBe(`Book ${name.toLowerCase()}`);
      expect(m.alternates?.canonical).toMatch(/^\/book\//);
    }
  });

  it("has a consultation page of its own and nothing for an unknown slug", async () => {
    expect(await book.generateMetadata(params({ slug: "consultation" }))).toMatchObject({ title: "Book a consultation", alternates: { canonical: "/book/consultation" } });
    expect(await book.generateMetadata(params({ slug: "nope" }))).toEqual({});
  });
});

describe("/graduation-photos/[campus]", () => {
  it("prerenders each guide under the graduation page", async () => {
    expect(campus.generateStaticParams()).toEqual(CAMPUS_GUIDES.map((c) => ({ campus: c.slug })));
    for (const c of CAMPUS_GUIDES) {
      const m = await campus.generateMetadata(params({ campus: c.slug }));
      expect(m).toMatchObject({ title: c.title, alternates: { canonical: `/graduation-photos/${c.slug}` } });
    }
    expect(await campus.generateMetadata(params({ campus: "nope" }))).toEqual({});
  });
});
