import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MtIntro } from "@/components/v3/mt/intro";

vi.mock("@/image-loader", () => ({ default: ({ src, width }: { src: string; width: number }) => `/cdn-cgi/image/width=${width},format=auto${src}` }));

/* The intro's extra frames are loaded off the page, so nothing else retries
   them: one the resizer refuses is asked for again as its plain file, once. */
type Probe = { src: string; onload: (() => void) | null; onerror: (() => void) | null };
const probes: Probe[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.v3motion;
  delete document.documentElement.dataset.mtIntro;
  sessionStorage.clear();
});

describe("MtIntro extras", () => {
  it("asks for a refused thumb again as its plain file, once", () => {
    vi.stubGlobal("Image", class { src = ""; onload = null; onerror = null; constructor() { probes.push(this); } });
    document.documentElement.dataset.v3motion = "";
    document.body.innerHTML = '<div data-mt="hero"><div class="mt-wall"></div></div>';
    const extras = Array.from({ length: 18 }, (_, i) => ({ src: `/work/nyx/${i}.jpg`, name: "", meta: "", slug: "nyx", r: 1 }));
    render(<MtIntro extras={extras} />); // the first 16 are the wall's own; the rest are the intro's
    expect(probes.map((p) => p.src)).toEqual(["/cdn-cgi/image/width=640,format=auto/work/nyx/16.jpg", "/cdn-cgi/image/width=640,format=auto/work/nyx/17.jpg"]);
    probes[0].onerror!();
    expect(probes[0].src).toBe("/work/nyx/16.jpg");
    expect(probes[0].onerror).toBeNull(); // a second failure is final
    expect(probes[1].src).toContain("/cdn-cgi/");
  });
});
