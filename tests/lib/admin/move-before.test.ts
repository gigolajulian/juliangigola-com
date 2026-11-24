import { describe, expect, it } from "vitest";
import { moveBefore } from "@/lib/admin/move-before";

const id = (s: string) => s;

describe("moveBefore", () => {
  it("moves forward onto the target's spot", () => {
    expect(moveBefore(["a", "b", "c", "d"], "a", "c", id)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves backward onto the target's spot", () => {
    expect(moveBefore(["a", "b", "c", "d"], "d", "b", id)).toEqual(["a", "d", "b", "c"]);
  });

  it("swaps neighbours either way", () => {
    expect(moveBefore(["a", "b", "c"], "a", "b", id)).toEqual(["b", "a", "c"]);
    expect(moveBefore(["a", "b", "c"], "c", "b", id)).toEqual(["a", "c", "b"]);
  });

  it("reads keys through keyOf and leaves the input alone", () => {
    const rows = [{ id: "x" }, { id: "y" }, { id: "z" }];
    expect(moveBefore(rows, "x", "z", (r) => r.id)?.map((r) => r.id)).toEqual(["y", "z", "x"]);
    expect(rows.map((r) => r.id)).toEqual(["x", "y", "z"]);
  });

  it("is null when nothing moves", () => {
    expect(moveBefore(["a", "b"], "a", "a", id)).toBeNull();
    expect(moveBefore(["a", "b"], "q", "a", id)).toBeNull();
    expect(moveBefore(["a", "b"], "a", "q", id)).toBeNull();
  });
});
