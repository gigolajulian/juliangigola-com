import { afterEach, describe, expect, it } from "vitest";
import { paintedCopy, rememberPainted, resetPainted } from "@/components/cover/lightbox/painted";
import { sideSize } from "@/components/cover/lightbox/stage";

afterEach(() => resetPainted());

describe("lightbox parts", () => {
  it("remembers the copy the viewer painted, by frame", () => {
    expect(paintedCopy("/a.jpg")).toBeUndefined();
    rememberPainted("/a.jpg", "/a-1920.jpg");
    expect(paintedCopy("/a.jpg")).toBe("/a-1920.jpg");
    resetPainted();
    expect(paintedCopy("/a.jpg")).toBeUndefined();
  });

  it("sizes a neighbour at 78% of the picture's height while it fits the room", () => {
    expect(sideSize({ w: 600, h: 800, vw: 2400 }, { width: 3, height: 4 })).toEqual({ w: 468, h: 624 });
  });

  it("shrinks a neighbour to the room, and drops it below a sliver", () => {
    // room = 1600 / 2 - 300 - 56 - 24 = 420; turned width 0.72 * w must fit it
    const box = sideSize({ w: 600, h: 800, vw: 1600 }, { width: 4, height: 3 })!;
    expect(Math.abs(box.w * 0.72 - 420)).toBeLessThan(1);
    expect(sideSize({ w: 600, h: 800, vw: 860 }, { width: 3, height: 4 })).toBeNull();
  });
});
