import { describe, expect, it } from "vitest";
import { endLine } from "@/lib/end-lines";
import { PROJECTS, commissionsIn } from "@/lib/work";

/* The end card's headline (`lib/end-lines.ts`). */

describe("endLine", () => {
  it("gives every project a two-part line and a way to ask", () => {
    for (const p of PROJECTS) {
      const e = endLine(p);
      expect(e.lead.endsWith(","), p.slug).toBe(true);
      expect(e.punch, p.slug).toBeTruthy();
      expect(e.ask.item.slug, p.slug).toBeTruthy();
    }
  });

  it("does not repeat a line between neighbours in a discipline", () => {
    const pool = commissionsIn("editorial");
    for (let i = 1; i < pool.length; i++) {
      const [a, b] = [endLine(pool[i - 1]), endLine(pool[i])];
      expect(`${a.lead} ${a.punch}`).not.toBe(`${b.lead} ${b.punch}`);
    }
  });

  it("ends a session set on booking it, a commission on the form with the project", () => {
    const session = PROJECTS.find((p) => p.categories.some((c) => c.slug === "headshots" && c.section === "SESSIONS"));
    if (session) {
      const e = endLine(session);
      expect(e.book).toBe(true);
      expect(e.ask.item.slug).toBe("headshots");
    }
    const commission = commissionsIn("editorial")[0];
    const e = endLine(commission);
    expect(e.book).toBe(false);
    expect(e.ask.item.form?.ref).toBe(commission.name);
  });
});
