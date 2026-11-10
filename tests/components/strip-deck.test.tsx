import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSections } from "@/components/strip/deck";
import { nav, SECTIONS_FIRST } from "@/components/strip/shared";

const cells = [0, 1, 2, 3, 4].map((i) => (
  <div key={i} data-deck="">
    {i}
  </div>
));

afterEach(() => {
  nav.hydrated = false;
});

describe("useSections", () => {
  it("shows every cell when not deferred", () => {
    const { result } = renderHook(() => useSections(cells, false, undefined));
    expect(result.current.sections).toBe(Infinity);
    expect(result.current.holding).toBe(false);
    expect(result.current.shown).toBe(cells);
  });

  it("holds the later sections back after hydration", () => {
    nav.hydrated = true;
    nav.poppedAt = 0;
    nav.aimedAt = 0;
    const { result } = renderHook(() => useSections(cells, true, "pile"));
    expect(result.current.sections).toBe(SECTIONS_FIRST);
    expect(result.current.holding).toBe(true);
  });

  it("a deck of screens keeps a placeholder for each held screen", () => {
    nav.hydrated = true;
    nav.poppedAt = 0;
    nav.aimedAt = 0;
    const { result } = renderHook(() => useSections(cells, true, "screens"));
    const shown = result.current.shown as React.ReactElement<Record<string, unknown>>[];
    expect(shown).toHaveLength(cells.length);
    expect(shown.filter((c) => "data-held" in c.props)).toHaveLength(cells.length - 1);
  });
});
