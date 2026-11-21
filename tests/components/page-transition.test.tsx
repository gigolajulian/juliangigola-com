/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors stand in for the links the component wraps */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

// ViewTransition is canary-only; the installed react has none.
vi.mock("react", async (orig) => {
  const r = await orig<typeof import("react")>();
  return { ...r, ViewTransition: ({ children }: { children: ReactNode }) => children };
});

const nav = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));

import { PageTransition } from "@/components/site/page-transition";

describe("PageTransition", () => {
  it("renders its page", () => {
    render(
      <PageTransition>
        <h1>Page</h1>
      </PageTransition>,
    );
    expect(screen.getByRole("heading", { name: "Page" })).toBeTruthy();
  });

  it("marks a press into another page when V3 motion is on", () => {
    document.documentElement.setAttribute("data-v3motion", "");
    render(
      <PageTransition>
        <a href="/portfolio/x" onClick={(e) => e.preventDefault()}>
          Open
        </a>
      </PageTransition>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Open" }));
    expect(document.documentElement.dataset.nav).toBe("in");
    document.documentElement.removeAttribute("data-v3motion");
    delete document.documentElement.dataset.nav;
  });

  it("Back from Cover art to the home slides the page off opaque, other Backs keep the fade", () => {
    const root = document.documentElement;
    root.setAttribute("data-v3motion", "");
    const vt = vi.fn((cb: () => unknown) => (cb(), { finished: new Promise(() => {}) }));
    Object.assign(document, { startViewTransition: vt });
    const back = (from: string, to: string) => {
      nav.path = from;
      history.replaceState(null, "", from);
      const r = render(<PageTransition>page</PageTransition>);
      history.replaceState(null, "", to);
      dispatchEvent(new PopStateEvent("popstate"));
      const off = root.dataset.navOff;
      r.unmount();
      delete root.dataset.navOff;
      return off;
    };
    expect(back("/portfolio/coverart", "/")).toBe("");
    expect(back("/portfolio/editorial", "/")).toBeUndefined();
    expect(vt).toHaveBeenCalledTimes(2);
    Reflect.deleteProperty(document, "startViewTransition");
    root.removeAttribute("data-v3motion");
    delete root.dataset.nav;
    nav.path = "/";
  });
});
