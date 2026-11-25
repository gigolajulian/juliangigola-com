import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The old Google appointment picker is gone, so no page may frame Google Calendar.
const frameSrc = (text: string) => text.match(/frame-src 'self'[^;"]*/)?.[0] ?? "";

describe("CSP frame-src", () => {
  for (const file of ["next.config.ts", "public/_headers"]) {
    it(`${file} does not allow calendar.google.com`, () => {
      const src = frameSrc(readFileSync(file, "utf8"));
      expect(src).toContain("js.stripe.com");
      expect(src).not.toContain("calendar.google.com");
    });
  }
});
