import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notesText, readNotes, writeNote } from "@/lib/arrange-notes";

/* Julian's notes from the cover's arrange inspector (`lib/arrange-notes.ts`),
   kept in sessionStorage. */

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());

const note = (text: string) => ({ card: "Card 2", photo: "liminal/01", layout: "upright", text });

describe("arrange notes", () => {
  it("writes, reads back and lists notes for a paste", () => {
    writeNote("a", note(" move left "));
    expect(readNotes()).toEqual({ a: note(" move left ") });
    expect(notesText()).toBe("Notes on the photographs:\n\n- Card 2 (liminal/01), upright: move left");
  });

  it("drops a note cleared to blank", () => {
    writeNote("a", note("move left"));
    writeNote("a", note("   "));
    expect(readNotes()).toEqual({});
    expect(notesText()).toBe("");
  });

  it("reads a corrupt store as no notes", () => {
    store.set("jg-arrange-notes", "{not json");
    expect(readNotes()).toEqual({});
  });
});
