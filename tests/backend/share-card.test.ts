import { describe, expect, it } from "vitest";
import { CARD_SIZE, pickFrames } from "@/lib/share-card";
import type { Frame } from "@/lib/work-types";

/* Which frames a link card shows: the first always, a second only when
   it pairs: two portraits side by side, or one of the other shape. */

const f = (src: string, w: number, h: number) => ({ src, width: w, height: h, alt: "", color: "#000" }) as Frame;
const tall = (n: string) => f(n, 2, 3);
const wide = (n: string) => f(n, 3, 2);

describe("pickFrames", () => {
  it("is empty for an empty pool and the first alone when nothing pairs", () => {
    expect(pickFrames([])).toEqual([]);
    expect(pickFrames([wide("a"), wide("b")]).map((x) => x.src)).toEqual(["a"]);
  });
  it("pairs two portraits in a row", () => {
    expect(pickFrames([tall("a"), tall("b"), wide("c")]).map((x) => x.src)).toEqual(["a", "b"]);
  });
  it("finds a mate of the other shape within the next five", () => {
    expect(pickFrames([wide("a"), wide("b"), tall("c")]).map((x) => x.src)).toEqual(["a", "c"]);
    expect(pickFrames([wide("a"), ...[1, 2, 3, 4, 5].map((n) => wide(`w${n}`)), tall("late")]).map((x) => x.src)).toEqual(["a"]);
  });
  it("draws at the link card size", () => {
    expect(CARD_SIZE).toEqual({ width: 1200, height: 630 });
  });
});
