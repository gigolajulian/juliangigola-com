import { describe, expect, it } from "vitest";
import { COVER_WIDTH, MAX_WIDTH, toSlug } from "@/lib/admin/admin-image";

/* The pure half of /admin's image handling (`lib/admin/admin-image.ts`); the
   canvas work needs a browser and is not covered here. */

describe("toSlug", () => {
  it("makes a route and folder name from a shoot's name", () => {
    expect(toSlug("Some Shoot Name")).toBe("some-shoot-name");
    expect(toSlug("  Café Noir!! ")).toBe("cafe-noir");
    expect(toSlug("A/B & C")).toBe("a-b-c");
    expect(toSlug("---")).toBe("");
  });

  it("keeps the cover narrower than the full frame", () => {
    expect(COVER_WIDTH).toBeLessThan(MAX_WIDTH);
  });
});
