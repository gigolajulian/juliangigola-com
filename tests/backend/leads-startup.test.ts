import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STARTUP_SCREENS, startupFile, startupImages } from "@/lib/leads-startup";

/* iOS shows a startup screen only for an exact size match: one per size,
   each with its PNG on disk. */

describe("leads startup screens", () => {
  it("names each file by its device pixels", () => {
    expect(startupFile([390, 844, 3])).toBe("/leads-app/startup/1170x2532.png");
  });
  it("has one entry per screen, each PNG generated", () => {
    const files = STARTUP_SCREENS.map(startupFile);
    expect(new Set(STARTUP_SCREENS.map((s) => s.join("x"))).size).toBe(STARTUP_SCREENS.length);
    for (const f of files) expect(existsSync(join(process.cwd(), "public", f)), f).toBe(true);
  });
  it("matches each image to its device in portrait", () => {
    expect(startupImages).toHaveLength(STARTUP_SCREENS.length);
    expect(startupImages[0].media).toBe("(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)");
  });
});
