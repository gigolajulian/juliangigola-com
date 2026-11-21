import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CoverPage } from "@/components/cover/cover-page";
import { CampusSpots } from "@/components/v3/campus-spots";
import { ServiceBar } from "@/components/v3/service-bar";
import { LogoBand } from "@/components/v3/logo-band";
import { V4Foot } from "@/components/v4/foot";
import { V4Project } from "@/components/v4/project";
import { V4Tilt } from "@/components/v4/tilt";
import { V4Drift } from "@/components/v4/drift";
import { BOOK_ROWS, QUOTE_OPTS } from "@/lib/v4-home/data";
import type { CoverRelease } from "@/lib/work/cover-art-types";

const nav = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useRouter: () => ({ push() {}, back() {} }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/lightbox", () => ({ useLightbox: () => ({ show() {} }), Lightbox: () => null }));
if (!globalThis.CSS?.escape) vi.stubGlobal("CSS", { escape: (s: string) => s });

/* The inner-pages trial (`?v4pages`): each piece is the live page with its key
   off, and its own thing with the key on. */
const flag = (keys: string) => (document.documentElement.dataset.v4pages = keys);
// Every query matches but reduced motion: a desktop mouse with motion allowed.
const desktop = () =>
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ matches: !q.includes("reduce)"), media: q, addEventListener() {}, removeEventListener() {} }) as never);
// An observer that reports everything it watches on screen at once.
const onScreen = () =>
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private cb: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.cb([{ target, isIntersecting: true } as IntersectionObserverEntry], this as never);
      }
      disconnect() {}
      unobserve() {}
    },
  );

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.v4pages;
  nav.path = "/";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (!globalThis.CSS?.escape) vi.stubGlobal("CSS", { escape: (s: string) => s });
  document.body.innerHTML = "";
});

const frame = (src: string) => ({ src, width: 800, height: 800, color: "#000", alt: "", thumb: src, side: null });
const releases: CoverRelease[] = [
  { slug: "one", title: "One", artist: "Ana", frames: [frame("/c/1.jpg")] },
  { slug: "two", title: "Two", artist: "Bo", frames: [frame("/c/2.jpg")] },
];

describe("CoverPage (c1)", () => {
  it("is the live page with the key off", () => {
    render(<CoverPage off={<p>live</p>} releases={releases} />);
    expect(screen.getByText("live")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Cover art" })).toBeNull();
  });

  it("counts the releases and asks for cover art, with the onward link", () => {
    flag("c1");
    render(<CoverPage off={<p>live</p>} releases={releases} onwards={{ href: "/portfolio/video", name: "Video" }} />);
    expect(screen.getByRole("heading", { name: "Cover art" })).toBeTruthy();
    expect(screen.getByText("2 releases")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Inquire" }).getAttribute("href")).toBe("/contact/form?type=coverart&ref=Cover+art");
    expect(screen.getByRole("link", { name: "Video" }).getAttribute("href")).toBe("/portfolio/video");
  });
});

describe("CampusSpots (s4)", () => {
  const spots = [
    { name: "Sather Gate", note: "Early light.", src: "/a.jpg", alt: "Gate" },
    { name: "Memorial Glade", note: "Open lawn.", src: "/b.jpg", alt: "Glade" },
  ];

  it("is the live rows with the key off", () => {
    render(<CampusSpots off={<p>rows</p>} spots={spots} />);
    expect(screen.getByText("rows")).toBeTruthy();
  });

  it("numbers each spot and lights the row crossing the middle", () => {
    flag("s4");
    onScreen();
    const { container } = render(<CampusSpots off={<p>rows</p>} spots={spots} />);
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["01 Sather Gate", "02 Memorial Glade"]);
    const rows = container.querySelectorAll(".s4-row");
    // both rows crossed in turn: the last one stays lit, with its photo
    expect(rows[1].hasAttribute("data-on")).toBe(true);
    expect(rows[0].hasAttribute("data-on")).toBe(false);
    expect(container.querySelectorAll(".s4-ph")[1].hasAttribute("data-on")).toBe(true);
  });
});

describe("ServiceBar (s1)", () => {
  const bar = <ServiceBar name="Portraits" rate="$450" label="Book portraits" href="#book" />;

  it("renders nothing with the key off", () => {
    render(bar);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("mounts the bar on <body>, linking to the page's booking", () => {
    flag("s1");
    render(bar);
    const link = screen.getByRole("link", { name: "Book portraits" });
    expect(link.getAttribute("href")).toBe("#book");
    expect(link.closest(".sv-bar")!.parentElement!.parentElement).toBe(document.body);
    expect(screen.getByText("$450")).toBeTruthy();
  });
});

describe("LogoBand (a2)", () => {
  it("is the plain grid with the key off", () => {
    const { container } = render(<LogoBand><i>A</i><i>B</i></LogoBand>);
    expect(container.querySelectorAll(".lg > i")).toHaveLength(2);
  });

  it("copies the marks to fill the line, hidden from readers, and takes them back on unmount", () => {
    flag("a2");
    desktop();
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(250);
    const fill: ResizeObserverCallback[] = [];
    vi.stubGlobal("ResizeObserver", class { constructor(cb: ResizeObserverCallback) { fill.push(cb); } observe() { fill.forEach((f) => f([], this as never)); } disconnect() {} });
    const { container, unmount } = render(<LogoBand><i>A</i><i>B</i></LogoBand>);
    const marks = container.querySelectorAll(".lg > i");
    // ceil(250 / 100) + 1 = 4 sets of two
    expect(marks).toHaveLength(8);
    expect([...marks].filter((m) => m.getAttribute("aria-hidden") === "true")).toHaveLength(6);
    const track = container.querySelector(".lg")!;
    unmount();
    expect(track.children).toHaveLength(2);
  });
});

describe("V4Foot", () => {
  it("lists the sessions, the inquiry types, the pages and the ways to reach me", () => {
    render(<V4Foot />);
    const nav = screen.getByRole("navigation", { name: "Footer" });
    for (const b of BOOK_ROWS) expect(screen.getByRole("link", { name: b.name }).getAttribute("href")).toBe(`/book/${b.slug}`);
    const types: Record<string, string> = { Music: "/contact/form?type=coverart", Fashion: "/contact/form?type=editorial", Commercial: "/contact/form?type=campaign", Weddings: "/contact/form" };
    for (const o of QUOTE_OPTS) expect(screen.getByRole("link", { name: o.name }).getAttribute("href")).toBe(types[o.name]);
    expect(nav.querySelector('a[href="mailto:hello@juliangigola.com"]')).toBeTruthy();
    expect(screen.getByRole("link", { name: "Legal" }).getAttribute("href")).toBe("/legal");
    expect(document.body.textContent).toContain(`© ${new Date().getFullYear()} Julian Gigola`);
  });

  it("says Book me off a project page and the same line on every visit to one", () => {
    render(<V4Foot />);
    expect(screen.getByRole("link", { name: "Book me" }).getAttribute("href")).toBe("/book");
    cleanup();
    nav.path = "/portfolio/paradox";
    const a = render(<V4Foot />).container.querySelector(".v4f-phrase")!.getAttribute("aria-label");
    const b = render(<V4Foot />).container.querySelectorAll(".v4f-phrase")[0].getAttribute("aria-label");
    expect(a).toBe(b);
    expect(a).toBeTruthy();
  });
});

describe("V4Project (view)", () => {
  const frames = [
    { s: "x", src: "/x/01.jpg", alt: "", wide: false, sq: false },
    { s: "x", src: "/x/02.jpg", alt: "", wide: false, sq: false },
  ];
  const page = () => {
    document.body.innerHTML = `<div id="p-project"><figure class="pj-big"><a href="/c">logo</a></figure><div class="pj-flow"><figure class="pj-r"></figure></div></div>`;
  };

  it("leaves the frames alone with the key off", () => {
    page();
    render(<V4Project frames={frames} />);
    expect(document.querySelector(".pj-big")!.getAttribute("role")).toBeNull();
  });

  it("makes each frame a button that names its place, and undoes it on unmount", () => {
    page();
    flag("view");
    const { unmount } = render(<V4Project frames={frames} />);
    const figs = document.querySelectorAll("#p-project figure");
    expect([...figs].map((f) => f.getAttribute("aria-label"))).toEqual(["Open frame 1 of 2", "Open frame 2 of 2"]);
    expect(figs[0].getAttribute("role")).toBe("button");
    unmount();
    expect(figs[0].getAttribute("role")).toBeNull();
  });

  it("feeds the Next stage's wipe on desktop", () => {
    document.body.innerHTML = `<div id="p-project"><a class="pj-next"></a></div>`;
    flag("next");
    desktop();
    render(<V4Project frames={frames} />);
    expect((document.querySelector(".pj-next") as HTMLElement).style.getPropertyValue("--in")).toMatch(/^\d\.\d{3}$/);
  });
});

describe("V4Tilt (tilt)", () => {
  const raf = () => {
    const q: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => q.push(f));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    return () => q.splice(0).forEach((f) => f(0));
  };

  it("does nothing with the key off", () => {
    document.body.innerHTML = `<div id="p-work"><div class="wstrip"></div></div>`;
    desktop();
    const step = raf();
    render(<V4Tilt k="a" />);
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 0, clientY: 0 });
    step();
    expect((document.querySelector(".wstrip") as HTMLElement).style.transform).toBe("");
  });

  it("leans the view toward the mouse and flattens it on unmount", () => {
    document.body.innerHTML = `<div id="p-work"><div class="wstrip"></div></div>`;
    flag("tilt");
    desktop();
    const step = raf();
    const { unmount } = render(<V4Tilt k="a" />);
    const ev = new Event("pointermove") as PointerEvent;
    Object.assign(ev, { pointerType: "mouse", clientX: 0, clientY: 0 });
    act(() => void window.dispatchEvent(ev));
    step();
    const el = document.querySelector(".wstrip") as HTMLElement;
    expect(el.style.transform).toMatch(/^perspective\(1400px\) rotateX\(.+deg\) rotateY\(-.+deg\)$/);
    unmount();
    expect(el.style.transform).toBe("");
  });
});

describe("V4Drift (p3)", () => {
  const grid = () => (document.body.innerHTML = `<div id="p-work"><div class="wgrid"><a class="wt"></a><a class="wt"></a></div></div>`);

  it("marks nothing with the key off", () => {
    grid();
    desktop();
    onScreen();
    render(<V4Drift k="a" />);
    expect(document.querySelectorAll("[data-v4d]")).toHaveLength(0);
  });

  it("marks the tiles near the screen where scroll timelines run, and lags them on scroll", () => {
    grid();
    flag("p3");
    desktop();
    onScreen();
    vi.stubGlobal("CSS", { supports: () => true, escape: (s: string) => s });
    render(<V4Drift k="a" />);
    expect(document.querySelectorAll(".wt[data-v4d]")).toHaveLength(2);
    fireEvent.scroll(window);
    expect(document.querySelector(".wgrid")!.hasAttribute("data-v4lag")).toBe(true);
  });
});
