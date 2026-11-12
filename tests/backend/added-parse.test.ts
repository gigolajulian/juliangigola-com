import { describe, expect, it } from "vitest";
import { instagramHandle } from "@/lib/added";

/* The handle goes into an href: only Instagram's alphabet gets through. */
describe("instagramHandle", () => {
  it.each([
    ["@juliangigola", "juliangigola"],
    ["JulianGigola", "juliangigola"],
    ["https://www.instagram.com/julian.gigola/?hl=en", "julian.gigola"],
    ["http://instagram.com/a_b#top", "a_b"],
    ["  @@a.b_c9  ", "a.b_c9"],
    ["a".repeat(30), "a".repeat(30)],
  ])("keeps %s as %s", (raw, want) => expect(instagramHandle(raw)).toBe(want));

  it.each([".hidden", "..", "javascript:alert(1)", "a".repeat(31), "", "a b", "@/x", "<b>"])("refuses %s", (raw) =>
    expect(instagramHandle(raw)).toBeNull());
});
