import { describe, expect, it } from "vitest";
import { feed } from "@/lib/proofs/desk";
import type { Viewer, ViewerEvent } from "@/lib/proofs/proof";

/* Today's gallery activity (Julian 2026-11-15): every gallery's opens, picks, sends and downloads, newest first. */

const v = (events: ViewerEvent[], name?: string): Viewer => ({ name, first: events[0].at, last: events.at(-1)!.at, visits: 1, seconds: 0, devices: [], places: [], picks: [], looks: {}, events });
const t = (m: number) => `2026-11-15T10:${String(m).padStart(2, "0")}:00.000Z`;

describe("feed", () => {
  it("merges galleries newest first, folds a run of picks, and leaves out test addresses", () => {
    const a = { token: "A", name: "Ana portraits", viewers: { "ana@gmail.com": v([{ at: t(1), kind: "open" }, { at: t(2), kind: "pick", id: "x" }, { at: t(3), kind: "pick", id: "y" }, { at: t(4), kind: "unpick", id: "x" }, { at: t(5), kind: "pick", id: "z" }, { at: t(6), kind: "send" }], "Ana") } };
    const b = { token: "B", name: "Ben headshots", finals: [{ id: "f", file: "BEN1.jpg", w: 1, h: 1, bytes: 1, crc: 0 }], viewers: { "ben@gmail.com": v([{ at: t(7), kind: "download", id: "f" }, { at: t(8), kind: "download", id: "all" }]), "qa@example.com": v([{ at: t(9), kind: "open" }]) } };
    expect(feed([a, b]).map((x) => `${x.who} ${x.what} · ${x.gallery}`)).toEqual([
      "ben@gmail.com downloaded all · Ben headshots",
      "ben@gmail.com saved BEN1.jpg · Ben headshots",
      "Ana sent selects · Ana portraits",
      "Ana picked 3 · Ana portraits",
      "Ana opened · Ana portraits",
    ]);
    expect(feed([a, b], 2)).toHaveLength(2);
  });
});
