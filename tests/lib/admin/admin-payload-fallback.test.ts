import { describe, expect, it } from "vitest";
import { adoptable, type ProjectsFile } from "@/lib/admin/admin-payload";

/* `adoptable` keeps the last good value for a field that is present but the
   wrong shape (a hand-edited file); frames and credits used to blank instead. */
type M = Parameters<typeof adoptable>[1];
const fallback = { frames: { a: [1] }, credits: { a: ["x"] } } as unknown as M;

describe("adoptable", () => {
  it.each(["frames", "credits"] as const)("keeps the fallback %s when the field is malformed", (k) => {
    const out = adoptable({ [k]: "not a map" } as unknown as ProjectsFile, fallback);
    expect(out[k]).toBe(fallback[k]);
  });

  it.each(["frames", "credits"] as const)("takes well-formed %s from the file", (k) => {
    const out = adoptable({ [k]: { b: [2] } } as unknown as ProjectsFile, fallback);
    expect(out[k]).toEqual({ b: [2] });
  });

  it.each(["frames", "credits"] as const)("reads an absent %s as empty, not the fallback", (k) => {
    expect(adoptable({} as ProjectsFile, fallback)[k]).toEqual({});
  });
});
