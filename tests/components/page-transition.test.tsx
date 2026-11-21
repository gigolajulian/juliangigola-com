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

import { PageTransition, holdLanding } from "@/components/site/page-transition";

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

  it("Back from the Cover art viewer to the home slides a copy of the viewer off once the home lands, with no view transition", async () => {
    const root = document.documentElement;
    root.setAttribute("data-v3motion", "");
    const vt = vi.fn();
    Object.assign(document, { startViewTransition: vt });
    const slid: Keyframe[] = [];
    Element.prototype.animate = vi.fn(function (this: Element, k: Keyframe[] | PropertyIndexedKeyframes) {
      slid.push(k as Keyframe);
      return { finished: Promise.resolve() } as unknown as Animation;
    });
    const viewer = document.createElement("div");
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.textContent = "19 / 25";
    document.body.append(viewer);
    nav.path = "/portfolio/coverart";
    history.replaceState(null, "", "/portfolio/coverart");
    const r = render(<PageTransition>page</PageTransition>);
    history.replaceState(null, "", "/");
    dispatchEvent(new PopStateEvent("popstate"));
    const lid = document.body.lastElementChild as HTMLElement;
    expect(lid.getAttribute("aria-hidden")).toBe("true");
    expect(lid.textContent).toBe("19 / 25"); // the viewer, copied over the page
    expect(slid).toHaveLength(0); // held until the home is in place
    nav.path = "/";
    r.rerender(<PageTransition>home</PageTransition>);
    expect(slid).toHaveLength(1);
    await Promise.resolve();
    expect(lid.isConnected).toBe(false);
    expect(vt).not.toHaveBeenCalled();
    r.unmount();
    viewer.remove();
    Reflect.deleteProperty(document, "startViewTransition");
    Reflect.deleteProperty(Element.prototype, "animate");
    root.removeAttribute("data-v3motion");
    nav.path = "/";
  });

  it("a held Back lands once what it waits for is done, or after 300ms", async () => {
    vi.useFakeTimers();
    const root = document.documentElement;
    root.setAttribute("data-v3motion", "");
    let done = 0;
    Object.assign(document, {
      startViewTransition: (cb: () => Promise<void>) => (cb().then(() => done++), { finished: new Promise(() => {}) }),
    });
    nav.path = "/portfolio/coverart";
    history.replaceState(null, "", "/portfolio/coverart");
    const r = render(<PageTransition>page</PageTransition>);
    history.replaceState(null, "", "/");
    dispatchEvent(new PopStateEvent("popstate"));
    let decoded!: () => void;
    holdLanding(new Promise<void>((res) => (decoded = res)));
    nav.path = "/";
    r.rerender(<PageTransition>home</PageTransition>);
    await vi.advanceTimersByTimeAsync(100);
    expect(done).toBe(0); // still waiting on the cover
    decoded();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(1);
    r.unmount();
    vi.useRealTimers();
    Reflect.deleteProperty(document, "startViewTransition");
    root.removeAttribute("data-v3motion");
    delete root.dataset.nav;
  });
});
