import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import * as about from "@/app/about/page";
import * as bts from "@/app/bts/page";
import * as contact from "@/app/contact/page";
import * as commission from "@/app/contact/form/page";
import * as homeV4 from "@/app/home-v4/page";
import * as legal from "@/app/legal/page";
import * as notFound from "@/app/not-found";
import * as home from "@/app/page";
import * as portfolio from "@/app/portfolio/(index)/page";
import * as video from "@/app/portfolio/(index)/video/page";
import * as layout from "@/app/layout";
import { CATEGORIES, DISCIPLINES, PROJECTS, WITH_BTS, categoryLabel, titleCase } from "@/lib/work/work";
import { COMMISSION_TABS } from "@/lib/photos-and-sessions";
import { MOTION_SEO } from "@/lib/seo";
import { CONTENT } from "@/lib/content";
import { MT } from "@/lib/v4-home/server";
import ORDER from "@/lib/portfolio-order.json";

/* The big client views are stand-ins that keep their props, so the page's
   own work (which projects, in which order, which frames) is what is checked. */
const { got, keep } = vi.hoisted(() => {
  const got: Record<string, unknown> = {};
  const keep = (name: string) =>
    Object.assign(
      (props: Record<string, unknown>) => {
        got[name] = props;
        return <div data-testid={name}>{props.children as React.ReactNode}</div>;
      },
      { displayName: name },
    );
  return { got, keep };
});
vi.mock("@/components/portfolio/work", () => ({ V3Work: keep("V3Work") }));
vi.mock("@/components/home/rollback", () => ({ V3Home: keep("V3Home") }));
vi.mock("@/components/v4/home/gate", () => ({ MtGate: keep("MtGate") }));
vi.mock("@/components/v4/home/home", () => ({ MtHome: keep("MtHome") }));
vi.mock("@/components/portfolio/video", () => ({ V3Video: keep("V3Video") }));
vi.mock("@/components/about/about", () => ({ V3About: keep("V3About") }));
vi.mock("@/components/contact/inquire", () => ({ V3Inquire: keep("V3Inquire"), V3Commission: keep("V3Commission") }));
// next/font is compiled by Next; outside it the loader is only a class name.
vi.mock("next/font/local", () => ({ default: () => ({ variable: "font", className: "font" }) }));

beforeAll(() => {
  // jsdom has no Web Animations API (the 404's drift wall).
  Element.prototype.animate = vi.fn(() => ({ pause() {}, play() {}, cancel() {}, updatePlaybackRate() {}, currentTime: 0, playState: "paused", effect: { getComputedTiming: () => ({ progress: 0 }) } })) as never;
});

const og = (title: string) => ({ openGraph: { title: `${title} | Julian Gigola` }, twitter: { title: `${title} | Julian Gigola` } });

describe("static page metadata", () => {
  it.each([
    ["about", about.metadata, "About", "/about", "About"],
    ["bts", bts.metadata, "Behind the scenes", "/bts", null],
    ["contact", contact.metadata, "Inquire", "/contact", "Inquire"],
    ["contact/form", commission.metadata, "Commissions", "/contact/form", "Commissions"],
    ["legal", legal.metadata, "Legal", "/legal", "Terms and privacy"],
    ["portfolio", portfolio.metadata, "Photography Portfolio, San Francisco Bay Area", "/portfolio", "Portfolio"],
    ["video", video.metadata, MOTION_SEO.title, "/portfolio/video", "Video"],
  ])("%s claims its title, canonical and share text", (_, m, title, canonical, share) => {
    expect(m.title).toBe(title);
    expect(m.description).toBeTruthy();
    expect(m.alternates?.canonical).toBe(canonical);
    if (share) expect(m).toMatchObject(og(share));
  });

  it("keeps the 404 and the v4 home trial out of the index", () => {
    expect(notFound.metadata).toMatchObject({ robots: { index: false, follow: true }, alternates: { canonical: null } });
    expect(homeV4.metadata).toMatchObject({ robots: { index: false }, alternates: { canonical: "/" } });
    expect(homeV4.dynamic).toBe("force-dynamic");
    expect(home.metadata).toMatchObject(og("Photographer and creative director"));
  });

  it("frames every page title with the site name at the root", () => {
    expect(layout.metadata.title).toMatchObject({ template: "%s | Julian Gigola" });
    expect(layout.metadata.alternates?.canonical).toBe("/");
    expect(layout.metadata.metadataBase?.toString()).toMatch(/^https:\/\/juliangigola\.com/);
    expect(layout.viewport).toMatchObject({ width: "device-width", viewportFit: "cover" });
    expect(layout.viewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#000000" },
    ]);
  });
});

describe("page bodies", () => {
  it("about, contact, commissions and video hand off to their views", () => {
    render(<about.default />);
    render(<contact.default />);
    render(<commission.default />);
    render(<video.default />);
    for (const id of ["V3About", "V3Inquire", "V3Commission", "V3Video"]) expect(screen.getByTestId(id)).toBeTruthy();
    expect((got.V3Video as { videos: unknown }).videos).toBe(CONTENT.videos);
  });

  it("legal sets the terms and the privacy policy on one page", () => {
    render(<legal.default />);
    expect(screen.getAllByRole("heading").length).toBeGreaterThan(1);
    expect(document.body.textContent).toMatch(/privacy/i);
  });

  it("bts lists every shoot with BTS, numbered, each linking to its project", () => {
    render(<bts.default />);
    expect(screen.getByRole("heading", { level: 1, name: "Behind the scenes" })).toBeTruthy();
    const rows = screen.getAllByRole("heading", { level: 2 });
    expect(rows.map((h) => h.textContent)).toEqual(WITH_BTS.map((p) => titleCase(p.headline ?? p.name)));
    const first = document.getElementById(WITH_BTS[0].slug)!;
    expect(within(first).getByRole("link", { name: "See the shoot" }).getAttribute("href")).toBe(`/portfolio/${WITH_BTS[0].slug}`);
  });

  it("the 404 offers four disciplines and the two asks", () => {
    render(<notFound.default />);
    expect(screen.getByRole("heading", { name: "This frame never made the edit." })).toBeTruthy();
    const list = within(document.querySelector(".nf-list ol") as HTMLElement).getAllByRole("link");
    const discs = DISCIPLINES.filter((d) => d.href.startsWith("/portfolio")).slice(0, 4);
    expect(list.map((a) => a.getAttribute("href"))).toEqual([...discs.map((d) => d.href), "/#sessions", "/contact/form"]);
    expect(document.body.textContent).toContain(`© ${new Date().getFullYear()} Julian Gigola`);
  });
});

describe("/portfolio", () => {
  type Work = { work: { s: string; cover: string }[]; chip: Record<string, string>; frames: Record<string, { src: string; back?: { src: string } }[]> };
  const props = () => (render(<portfolio.default />), got.V3Work as Work);

  it("lists every project but real estate, in Julian's order first", () => {
    const { work } = props();
    const slugs = work.map((w) => w.s);
    expect(slugs).not.toContain("realestate");
    expect(new Set(slugs)).toEqual(new Set(PROJECTS.filter((p) => p.slug !== "realestate").map((p) => p.slug)));
    const known = slugs.filter((s) => ORDER.includes(s));
    expect(known).toEqual(ORDER.filter((s) => known.includes(s)));
    expect(slugs.slice(0, known.length)).toEqual(known);
  });

  it("names a chip for each discipline and folds a sleeve's back into its front", () => {
    const { chip, frames } = props();
    expect(Object.values(frames).flat().some((f) => f.back)).toBe(true);
    for (const c of CATEGORIES) expect(chip[c.slug]).toBe(categoryLabel(c));
    for (const list of Object.values(frames)) for (const f of list) expect(f.src).not.toMatch(/-b\.\w+$/);
    for (const list of Object.values(frames)) for (const f of list) if (f.back) expect(f.back.src).toBe(f.src.replace(/-a(\.\w+)$/, "-b$1"));
  });
});

describe("/", () => {
  it("gives each Commissions tab nine or five top projects of its discipline", async () => {
    render(await home.default());
    expect((got.MtGate as { data: unknown }).data).toBe(MT);
    const top = (got.V3Home as { top: Record<string, { s: string; meta: string }[]> }).top;
    expect(Object.keys(top).length).toBeGreaterThan(0);
    const tabs = COMMISSION_TABS.map(([, href]) => new URLSearchParams(href.split("?")[1]).get("d")).filter(Boolean);
    for (const [d, list] of Object.entries(top)) {
      expect(tabs).toContain(d);
      expect([5, 9]).toContain(list.length);
      for (const w of list) expect(PROJECTS.find((p) => p.slug === w.s)!.categories.some((c) => c.slug === d)).toBe(true);
      expect(list.map((w) => w.s)).not.toContain("realestate");
    }
  });

  it("the v4 trial route renders the v4 home with the server's data", () => {
    render(<homeV4.default />);
    expect((got.MtHome as { data: unknown }).data).toBe(MT);
  });
});
