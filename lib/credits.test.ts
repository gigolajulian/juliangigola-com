import { describe, expect, it } from "vitest";
import { CANON, isOwn } from "./credits";
import { ALL_PROJECTS } from "./work";

/* Fix with `npx tsx scripts/credits.mts`, or in /admin. */
describe("credits", () => {
  const all = ALL_PROJECTS.flatMap((p) => p.credits.map((c) => ({ slug: p.slug, ...c })));
  it("use the one role list", () => expect(all.filter((c) => !CANON.has(c.role)).map((c) => `${c.slug}: ${c.role}`)).toEqual([]));
  it("name people, not @handles", () => expect(all.filter((c) => !isOwn(c) && /@/.test(c.name)).map((c) => `${c.slug}: ${c.name}`)).toEqual([]));
});
