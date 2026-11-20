import { expect, test } from "vitest";
import { matchSong } from "@/lib/cover-art-match";

const m = (title: string, artist: string, trackName: string, artistName: string) => matchSong({ title, artist }, { trackName, artistName });

test("title and artist both equal", () => {
  expect(m("Jahannam", "Nameera", "Jahannam", "Nameera")).toBe("match");
  expect(m("The River", "TMEUPTEDDY", "the river", "Tmeupteddy")).toBe("match");
  expect(m("Est Modvs In Rebvs", "Nameera", "EST MODVS IN REBVS (feat. Parram)", "Nameera")).toBe("match");
  expect(m("Your Way", "The Szns ft. Swavie", "Your Way (feat. Swavie)", "The Szns")).toBe("match");
});

test("the wrong songs the search really returned", () => {
  expect(m("Top Tier", "BANX", "Top Tier Grind", "Rec Banx")).toBeNull();
  expect(m("Top Tier", "BANX", "Top Tier", "SEOUL TUNE")).toBeNull();
  expect(m("Faith & Hustle", "Sammy Shiblaq", "The Hustle", "Sammy Shiblaq")).toBeNull();
  expect(m("Savage", "BANX", "Weekend (feat. J Banx, Hyro the Don & Nubia Emmon)", "Trzan")).toBeNull();
  expect(m("Problem Child", "BANX", "Problem Child", "The Bon Scott Band")).toBeNull();
  expect(m("Wasted Years (Parsia Remix)", "London Grammar", "Wasted Years", "London Grammar")).toBeNull();
  expect(m("Hi-Fi", "Parsia", "Hi-Fi (Remix)", "Parsia")).toBeNull();
});

test("one of several Apple artists is listed, never taken", () => {
  expect(m("In the Hoodie on Your Sleeve", "Ericalisa", "In the Hoodie On Your Sleeve", "Ericalisa & Mayzin")).toBe("confirm");
  expect(m("Rockstar", "BANX", "Rockstar", "Banx & Ranx")).toBe("confirm");
});
