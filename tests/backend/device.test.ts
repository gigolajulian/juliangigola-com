import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MEDIA, matches, media, useDevice } from "@/lib/device";

/* The device queries (`lib/device.ts`), against a stubbed matchMedia. */

afterEach(() => vi.unstubAllGlobals());

describe("device queries", () => {
  it("asks the window the named query", () => {
    vi.stubGlobal("window", { matchMedia: (q: string) => ({ media: q, matches: q === MEDIA.fine }) });
    expect(media("large").media).toBe(MEDIA.large);
    expect(matches("fine")).toBe(true);
    expect(matches("phone")).toBe(false);
  });

  it("answers the server's guess when there is no window", () => {
    const Probe = ({ guess }: { guess: boolean }) => String(useDevice("phone", guess));
    expect(renderToString(createElement(Probe, { guess: true }))).toBe("true");
    expect(renderToString(createElement(Probe, { guess: false }))).toBe("false");
  });
});
