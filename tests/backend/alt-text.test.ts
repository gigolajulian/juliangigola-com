import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALT } from "@/lib/alt-text";

/* Written alt text by photo path (`lib/alt-text.ts`): every entry must
   point at a photograph the site serves, or it describes nothing. */

describe("ALT", () => {
  it("keys every description to a served photograph", () => {
    const missing = Object.keys(ALT).filter((p) => !p.startsWith("/") || !existsSync(join("public", p)));
    expect(missing).toEqual([]);
  });

  it("has no blank descriptions", () => {
    for (const a of Object.values(ALT)) expect(a.trim().length).toBeGreaterThan(5);
  });
});
