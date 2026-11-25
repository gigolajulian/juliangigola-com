import { describe, expect, it } from "vitest";
import { COMM_KEYS, COVER_KEYS, COVER_PRESS, FILM_DRESS, FILM_PICKS, HERO_KEYS } from "@/lib/home/data";
import { getProject } from "@/lib/work/work";
import { existsSync } from "node:fs";
import { HOME_DATA } from "@/lib/home/server";

/* The v4 home picks its photos, covers and films by hand-kept keys. A renamed project or film
   fails quietly (a fallback ratio, a film with no poster), so the keys are checked against the content here. */
describe("v4 home picks", () => {
  it("every hero and Commissions key is a frame of its project", () => {
    const lost = [...HERO_KEYS, ...COMM_KEYS].filter((k) => {
      const [slug, n] = k.split("/");
      return !getProject(slug)?.images.some((x) => x.src === `/work/${slug}/${n}.jpg`);
    });
    expect(lost).toEqual([]);
  });

  it("every film has a poster", () => {
    expect(HOME_DATA.films.filter((f) => !f.poster).map((f) => f.title)).toEqual([]);
  });

  it("every dressed film is one of the picks", () => {
    const picks: string[] = FILM_PICKS.map(([title]) => title);
    expect(Object.keys(FILM_DRESS).filter((t) => !picks.includes(t))).toEqual([]);
  });

  it("every cover has a pressing color", () => {
    expect(COVER_KEYS.filter((k) => !COVER_PRESS[k])).toEqual([]);
  });

  it("every session on the home has two more frames after its main photo", () => {
    expect(Object.entries(HOME_DATA.samples).filter(([, v]) => v.length !== 2).map(([k]) => k)).toEqual([]);
    expect(Object.values(HOME_DATA.samples).flat().filter((src) => !existsSync(`public${src}`))).toEqual([]);
  });
});
