import { describe, expect, it } from "vitest";
import { leadKey } from "./lead-keys";

const p = (key: string, mod: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) => ({ key, metaKey: false, ctrlKey: false, altKey: false, ...mod });

describe("leadKey", () => {
  it("opens the palette with cmd or ctrl K, even while typing", () => {
    expect(leadKey(p("k", { metaKey: true }), true, false)).toEqual({ do: "palette" });
    expect(leadKey(p("K", { ctrlKey: true }), false, false)).toEqual({ do: "palette" });
  });
  it("ignores every other key while a text field has focus", () => {
    for (const k of ["j", "e", "1", "Escape", "?"]) expect(leadKey(p(k), true, false)).toBeNull();
  });
  it("leaves browser shortcuts alone", () => {
    expect(leadKey(p("r", { metaKey: true }), false, false)).toBeNull();
    expect(leadKey(p("e", { altKey: true }), false, false)).toBeNull();
  });
  it("maps the single keys, caps lock or not", () => {
    expect(leadKey(p("J"), false, false)).toEqual({ do: "move", by: 1 });
    expect(leadKey(p("k"), false, false)).toEqual({ do: "move", by: -1 });
    expect(leadKey(p("r"), false, false)).toEqual({ do: "reply" });
    expect(leadKey(p("s"), false, false)).toEqual({ do: "snooze" });
    expect(leadKey(p("e"), false, false)).toEqual({ do: "archive" });
    expect(leadKey(p("n"), false, false)).toEqual({ do: "new" });
    expect(leadKey(p("?"), false, false)).toEqual({ do: "help" });
    expect(leadKey(p("Escape"), false, false)).toEqual({ do: "close" });
    expect(leadKey(p("x"), false, false)).toBeNull();
  });
  it("sets stages 1 to 9 only", () => {
    expect(leadKey(p("1"), false, false)).toEqual({ do: "stage", at: 0 });
    expect(leadKey(p("9"), false, false)).toEqual({ do: "stage", at: 8 });
    expect(leadKey(p("0"), false, false)).toBeNull();
  });
  it("reads 1, 3 and W as snooze lengths once S is pressed", () => {
    expect(leadKey(p("1"), false, true)).toEqual({ do: "snoozeFor", days: 1 });
    expect(leadKey(p("3"), false, true)).toEqual({ do: "snoozeFor", days: 3 });
    expect(leadKey(p("w"), false, true)).toEqual({ do: "snoozeFor", days: 7 });
    expect(leadKey(p("w"), false, false)).toBeNull();
    expect(leadKey(p("2"), false, true)).toBeNull();
  });
});
