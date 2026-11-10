import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_MARKS } from "@/lib/clients-data";

/* The generated client marks (`lib/clients-data.ts`). */

describe("CLIENT_MARKS", () => {
  it("gives every mark a positive scale and something to draw", () => {
    for (const [key, m] of Object.entries(CLIENT_MARKS)) {
      expect(m.scale, key).toBeGreaterThan(0);
      if (m.kind === "svg") {
        expect(m.viewBox.split(" ").map(Number).every(Number.isFinite), key).toBe(true);
        expect(m.body, key).toContain("<");
      } else {
        expect(m.width * m.height, key).toBeGreaterThan(0);
        expect(existsSync(join("public", m.src)), m.src).toBe(true);
      }
    }
  });
});
