import { describe, expect, it } from "vitest";
import { canonical } from "@/lib/seal";

describe("canonical", () => {
  it("drops Gmail dots and +tags, leaves other domains as typed", () => {
    expect(canonical(" Gigola.Julian+site@GoogleMail.com ")).toBe("gigolajulian@gmail.com");
    expect(canonical("a.b+c@example.com")).toBe("a.b+c@example.com");
  });
});
