import { describe, expect, it } from "vitest";
import data from "./frame-twins.json";
import { TWIN_THRESHOLD, backToBack, twinGroups, twinScore, twinStats } from "./frame-twins";

// The strongest stored pair: certainly a twin, whichever set it is in.
const [pair] = Object.values(data.sets as Record<string, { pairs: Record<string, number> }>)
  .flatMap((s) => Object.entries(s.pairs))
  .sort((x, y) => y[1] - x[1]);
const [a, b] = pair[0].split("|");
const other = "/work/none/99.jpg";

describe("frame twins", () => {
  it("reads a pair either way round", () => {
    expect(pair[1]).toBeGreaterThan(TWIN_THRESHOLD);
    expect(twinScore(a, b)).toBe(twinScore(b, a));
    expect(twinScore(a, other)).toBe(0);
  });

  it("letters a group, and only frames in it", () => {
    const g = twinGroups([other, a, b]);
    expect(g.get(a)).toBe("A");
    expect(g.get(b)).toBe("A");
    expect(g.has(other)).toBe(false);
  });

  it("marks back-to-back only when adjacent, and a passage breaks it", () => {
    expect([...backToBack([a, b, other])]).toEqual([b]);
    expect(backToBack([a, other, b]).size).toBe(0);
    expect(backToBack([a, "", b]).size).toBe(0);
  });

  it("counts twins left and back-to-back pairs", () => {
    expect(twinStats([a, b, other])).toEqual({ twins: 1, backToBack: 1 });
    expect(twinStats([a, other])).toEqual({ twins: 0, backToBack: 0 });
  });
});
