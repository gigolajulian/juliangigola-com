import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSiteTheme } from "@/lib/site-theme";
import { chooseView, search, useWorkQuery, useWorkView } from "@/lib/work-view";

/* The server's first render of the shared view, query and theme: it has
   no localStorage and no page to read, and must draw what the HTML will
   match on hydration. */

const Probe = () => createElement("i", null, `${useWorkView()}|${useWorkQuery()}|${useSiteTheme()}`);
const html = () => renderToString(createElement(Probe));

afterEach(() => {
  search("");
  vi.unstubAllGlobals();
});

describe("on the server", () => {
  it("draws the strip, no query, the dark theme", () => {
    expect(html()).toBe("<i>strip||dark</i>");
  });
  it("keeps the server snapshot while a search is live in the module", () => {
    search("wired");
    expect(html()).toBe("<i>strip||dark</i>");
  });
});

describe("chooseView", () => {
  it("remembers the choice and survives storage that throws", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem } });
    chooseView("grid");
    expect(setItem).toHaveBeenCalledWith("work-view", "grid");
    vi.stubGlobal("window", { localStorage: { setItem: () => { throw new Error("private"); } } });
    expect(() => chooseView("strip")).not.toThrow();
  });
});
