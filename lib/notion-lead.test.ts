import { afterEach, describe, expect, it, vi } from "vitest";
import { notionStage, toNotion } from "@/lib/notion-lead";
import type { Enquiry } from "@/lib/inbox";

type Call = { url: string; method: string; body: { properties?: Record<string, unknown>; filter?: unknown } };
/** A fake Notion: the query finds `row` (or fails), writes answer 200. */
function fake(row: string | null | "down") {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method!, body: JSON.parse(init.body as string) });
    if (url.endsWith("/query")) return row === "down" ? new Response("down", { status: 500 }) : Response.json({ results: row ? [{ id: row }] : [] });
    return Response.json({ id: "new-page" });
  });
  return calls;
}
const stored = { id: "x", at: "2026-11-04T10:00:00Z", type: "portrait", name: "Ana", email: "ana@example.com", detail: "", message: "Hi" } as Enquiry;

afterEach(() => vi.unstubAllGlobals());

describe("toNotion", () => {
  it("adds a row for a new address", async () => {
    const calls = fake(null);
    expect(await toNotion("t", { stored, status: "Inquiry", kind: "portrait" })).toBe("new-page");
    expect(calls.map((c) => `${c.method} ${c.url.split("/v1")[1]}`)).toEqual(["POST /databases/66054052b3724788a2d21c66c1a7562d/query", "POST /pages"]);
  });

  it("updates the row a known address already has, without pulling it back to Inquiry", async () => {
    const calls = fake("row-1");
    expect(await toNotion("t", { stored, status: "Inquiry" })).toBe("row-1");
    const w = calls[1];
    expect(`${w.method} ${w.url}`).toBe("PATCH https://api.notion.com/v1/pages/row-1");
    expect(w.body.properties).not.toHaveProperty("Status");
    expect(w.body.properties).not.toHaveProperty("Project Name");
    expect(w.body.properties).toHaveProperty("Last Contact");
  });

  it("gives a past client whose row is Delivered a new row, not a PATCH", async () => {
    // Their only row is Delivered; answer the query by its own filter, as Notion would.
    const calls: Call[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      calls.push({ url, method: init.method!, body });
      if (!url.endsWith("/query")) return Response.json({ id: "new-page" });
      const shut = (body.filter.and as { select?: { does_not_equal: string } }[]).some((f) => f.select?.does_not_equal === "Delivered");
      return Response.json({ results: shut ? [] : [{ id: "old-row" }] });
    });
    expect(await toNotion("t", { stored, status: "Inquiry" })).toBe("new-page");
    expect(calls.map((c) => c.method)).toEqual(["POST", "POST"]);
    expect(calls[1].url).toBe("https://api.notion.com/v1/pages");
  });

  it("moves a known row forward on a booking", async () => {
    const calls = fake("row-1");
    await toNotion("t", { stored, status: "Confirmed", kind: "headshots" });
    expect(calls[1].body.properties).toMatchObject({ Status: { select: { name: "Confirmed" } } });
  });

  it("still adds the row when the lookup fails, and does nothing without a token", async () => {
    const calls = fake("down");
    expect(await toNotion("t", { stored, status: "Inquiry" })).toBe("new-page");
    expect(calls[1].url).toBe("https://api.notion.com/v1/pages");
    expect(await toNotion(undefined, { stored, status: "Inquiry" })).toBeUndefined();
  });
});

describe("notionStage", () => {
  it("sets Status on the known page, maps Shot to Editing, and finds the row when it is not known", async () => {
    let calls = fake(null);
    expect(await notionStage("t", "ana@example.com", "Shot", "row-9")).toBe("row-9");
    expect(calls).toHaveLength(1);
    expect(calls[0].body.properties).toEqual({ Status: { select: { name: "Editing" } } });
    calls = fake("row-2");
    expect(await notionStage("t", "ana@example.com", "Quoted")).toBe("row-2");
    expect(calls[1].body.properties).toEqual({ Status: { select: { name: "Quoted" } } });
  });

  it("leaves a lead with no row alone and never throws", async () => {
    const calls = fake(null);
    expect(await notionStage("t", "ana@example.com", "Lost")).toBeUndefined();
    expect(calls).toHaveLength(1);
    fake("down");
    expect(await notionStage("t", "ana@example.com", "Lost")).toBeUndefined();
  });
});
