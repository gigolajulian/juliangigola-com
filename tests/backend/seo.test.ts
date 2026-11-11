import { describe, expect, it } from "vitest";
import { DISCIPLINE_SEO, ldJson, serviceGraph, siteGraph, SITE } from "@/lib/seo";
import { formatPrice, SESSION_TYPES } from "@/lib/booking/sessions";
import { projectFacts, share, shareOg } from "@/lib/share";
import { BOOKING_URL, RESPONSE_TIME } from "@/lib/site";

/* What the pages tell search engines and link previews: the JSON-LD, the
   share text, the link cards and the site's public claims. */

describe("ldJson", () => {
  it("escapes < so no string can close the script element", () => {
    const out = ldJson({ a: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).a).toBe("</script><script>alert(1)</script>");
  });
});

describe("siteGraph", () => {
  it("ties the person, the business and the site together by @id", () => {
    const g = siteGraph()["@graph"] as { "@type": string; "@id": string }[];
    const ids = g.map((n) => n["@id"]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([`${SITE}/#julian`, `${SITE}/#business`, `${SITE}/#website`]));
    const refs = JSON.stringify(g).match(/"@id":"[^"]+"/g)!.map((s) => s.slice(7, -1));
    for (const r of refs) expect(ids, r).toContain(r);
  });
});

describe("serviceGraph", () => {
  const p = { url: "/book/portraits", name: "Portraits", service: "Portrait photography", description: "d", price: 400, faqs: [{ q: "Q?", a: "A." }], places: ["San Jose", "Anywhere else"] };
  it("sells the service in its places, from its price, with its questions", () => {
    const [service, faq, crumbs] = serviceGraph(p)["@graph"] as Record<string, unknown>[];
    expect(service.areaServed).toEqual([{ "@type": "City", name: "San Jose" }]);
    expect(service.offers).toMatchObject({ priceSpecification: { minPrice: 400, priceCurrency: "USD" }, url: "https://juliangigola.com/book/portraits#book" });
    expect(faq["@type"]).toBe("FAQPage");
    expect(crumbs["@type"]).toBe("BreadcrumbList");
  });
  it("leaves out the offer on request and the FAQ when there are no questions", () => {
    const g = serviceGraph({ ...p, price: null, faqs: [] })["@graph"] as Record<string, unknown>[];
    expect(g).toHaveLength(2);
    expect(g[0]).not.toHaveProperty("offers");
  });
});

describe("DISCIPLINE_SEO", () => {
  it("gives every discipline its own title and a description", () => {
    const titles = Object.values(DISCIPLINE_SEO).map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const [slug, s] of Object.entries(DISCIPLINE_SEO)) expect(s.description(37).length, slug).toBeGreaterThan(50);
    expect(DISCIPLINE_SEO.editorial.description(37)).toContain("37 editorials");
  });
});

describe("share", () => {
  it("adds the site's name to the preview, not the bare title", () => {
    const m = share("Portraits", "One line.");
    expect(m.title).toBe("Portraits");
    expect(m.openGraph).toMatchObject({ title: "Portraits | Julian Gigola", siteName: "Julian Gigola", description: "One line." });
    expect(shareOg("A", "b")).not.toHaveProperty("title");
  });
  it("names the main credits, skipping crew roles", () => {
    const f = projectFacts({
      categories: [{ name: "Editorial" }],
      credits: [
        { role: "Photo", name: "Julian" },
        { role: "Model", name: "Kai Lin" },
        { role: "BTS video", name: "X" },
        { role: "Styling", name: "Mia R" },
        { role: "Hair", name: "" },
      ],
    });
    expect(f.credits).toEqual(["model Kai Lin", "styling Mia R"]);
    expect(f.description).toBe("Editorial by Julian Gigola, with model Kai Lin and styling Mia R.");
    expect(projectFacts({ categories: [], credits: [] }).description).toBe("Photography by Julian Gigola.");
  });
});

describe("sessions and site claims", () => {
  it("say a price or On request", () => {
    expect(formatPrice(null)).toBe("On request");
    expect(formatPrice(1500)).toBe("From $1,500");
  });
  it("have one entry per slug", () => {
    const slugs = SESSION_TYPES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("keep the booking link a public https URL and the reply promise non-empty", () => {
    if (BOOKING_URL !== null) expect(BOOKING_URL).toMatch(/^https:\/\//);
    if (RESPONSE_TIME !== null) expect(RESPONSE_TIME.trim()).not.toBe("");
  });
});
