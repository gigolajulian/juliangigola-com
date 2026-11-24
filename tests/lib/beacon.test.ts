import { describe, expect, it } from "vitest";
import { MAX_CLICKS, parseBeacon } from "@/lib/beacon";

/* What the click-and-scroll beacon may carry (`lib/beacon.ts`). */

const ok = { p: "/portfolio", v: true, d: 0.5, dev: "desktop", c: [[0.2, 1.5, "See the work"]] };

describe("parseBeacon", () => {
  it("passes a well formed beacon through", () => {
    expect(parseBeacon(ok)).toEqual(ok);
  });

  it("refuses admin and api pages, bad paths and bad fields", () => {
    expect(parseBeacon({ ...ok, p: "/admin" })).toBeNull();
    expect(parseBeacon({ ...ok, p: "/api/beacon" })).toBeNull();
    expect(parseBeacon({ ...ok, p: "portfolio" })).toBeNull();
    expect(parseBeacon({ ...ok, p: "/a b" })).toBeNull();
    expect(parseBeacon({ ...ok, d: 1.2 })).toBeNull();
    expect(parseBeacon({ ...ok, v: "yes" })).toBeNull();
    expect(parseBeacon({ ...ok, dev: "watch" })).toBeNull();
    expect(parseBeacon({ ...ok, c: Array(MAX_CLICKS + 1).fill([0, 0, "x"]) })).toBeNull();
    expect(parseBeacon(null)).toBeNull();
  });

  it("keeps an /administration page, which is not /admin", () => {
    expect(parseBeacon({ ...ok, p: "/administration" })).not.toBeNull();
  });

  it("drops malformed clicks and cuts labels to 40 characters", () => {
    const b = parseBeacon({ ...ok, c: [[2, 0, "off the window"], [0.1, 0.1, "x".repeat(60)], "junk"] })!;
    expect(b.c).toEqual([[0.1, 0.1, "x".repeat(40)]]);
  });
});
