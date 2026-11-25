import { describe, expect, it } from "vitest";
import { projectFacts, shareMeta, shareOg } from "@/lib/og/share";

describe("og share", () => {
  it("shareMeta keeps the bare title and adds the site to the previews", () => {
    const m = shareMeta("Portraits", "One line.");
    expect(m.title).toBe("Portraits");
    expect(m.description).toBe("One line.");
    expect(m.openGraph).toMatchObject({
      siteName: "Julian Gigola",
      locale: "en_US",
      title: "Portraits | Julian Gigola",
      description: "One line.",
    });
    expect(m.twitter).toEqual({ card: "summary_large_image", title: "Portraits | Julian Gigola", description: "One line." });
  });

  it("shareOg leaves the page title alone", () => {
    expect(shareOg("A", "b")).not.toHaveProperty("title");
  });

  it("projectFacts lists up to three main credits and skips crew roles", () => {
    const f = projectFacts({
      categories: [{ name: "Editorial" }],
      credits: [
        { role: "Photographer", name: "Julian" },
        { role: "Model", name: "Kai Lin" },
        { role: "Styling", name: "Mia R" },
        { role: "Lighting tech", name: "X" },
        { role: "Hair", name: "Ana" },
        { role: "Makeup", name: "Bo" },
        { role: "Set", name: "" },
      ],
    });
    expect(f.discipline).toBe("Editorial");
    expect(f.credits).toEqual(["model Kai Lin", "styling Mia R", "hair Ana"]);
    expect(f.description).toBe("Editorial by Julian Gigola, with model Kai Lin, styling Mia R and hair Ana.");
  });

  it("projectFacts falls back to Photography with no credits", () => {
    const f = projectFacts({ categories: [], credits: [] });
    expect(f.description).toBe("Photography by Julian Gigola.");
    expect(projectFacts({ categories: [], credits: [{ role: "Model", name: "Kai" }] }).description).toBe(
      "Photography by Julian Gigola, with model Kai.",
    );
  });
});
