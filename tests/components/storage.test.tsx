import { afterEach, describe, expect, it, vi } from "vitest";
import { localGet, localRemove, localSet, sessionJson, sessionRemove, sessionSet } from "@/lib/storage";

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

const broken = () => {
  for (const m of ["getItem", "setItem", "removeItem"] as const)
    vi.spyOn(Storage.prototype, m).mockImplementation(() => {
      throw new Error("storage off");
    });
};

describe("storage helpers", () => {
  it("sessionJson reads JSON, and null when missing or not JSON", () => {
    expect(sessionJson("k")).toBeNull();
    sessionSet("k", JSON.stringify({ a: 1 }));
    expect(sessionJson<{ a: number }>("k")).toEqual({ a: 1 });
    sessionSet("k", "{nope");
    expect(sessionJson("k")).toBeNull();
    sessionRemove("k");
    expect(sessionStorage.getItem("k")).toBeNull();
  });

  it("localGet, localSet and localRemove round trip", () => {
    expect(localGet("k")).toBeNull();
    localSet("k", "1");
    expect(localGet("k")).toBe("1");
    localRemove("k");
    expect(localGet("k")).toBeNull();
  });

  it("never throws when storage does", () => {
    broken();
    expect(sessionJson("k")).toBeNull();
    expect(localGet("k")).toBeNull();
    expect(() => (sessionRemove("k"), localSet("k", "1"), localRemove("k"))).not.toThrow();
  });
});
