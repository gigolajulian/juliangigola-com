import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("manifest", () => {
  it("installs on the dark ground with an any and a maskable icon", () => {
    const m = manifest();
    expect(m).toMatchObject({ start_url: "/", display: "standalone", background_color: "#0b0a09", theme_color: "#0b0a09" });
    expect(m.icons?.map((i) => i.purpose)).toEqual(["any", "any", "maskable"]);
  });
});
