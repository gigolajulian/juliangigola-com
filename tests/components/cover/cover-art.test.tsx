import { describe, expect, it } from "vitest";
import { SHOWN } from "@/components/cover/cover-art";

describe("cover-art", () => {
  it("counts ten covers for the admin picker", () => {
    expect(SHOWN).toBe(10);
  });
});
