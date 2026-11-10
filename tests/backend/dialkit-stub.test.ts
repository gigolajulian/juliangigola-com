import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { DialRoot, DialStore, useDialKit, useDialKitController } from "@/lib/dialkit-stub";

/* DialKit's production stand-in (`lib/dialkit-stub.ts`): every read
   returns the default written in the config. */

const read = (config: Record<string, unknown>) => {
  let out: unknown;
  const Probe = () => {
    out = useDialKit("test", config);
    return null;
  };
  renderToString(createElement(Probe));
  return out;
};

describe("useDialKit", () => {
  it("returns each leaf's default", () => {
    expect(read({ size: [12, 0, 40, 1], on: true, label: "x", n: 3 })).toEqual({ size: 12, on: true, label: "x", n: 3 });
  });

  it("defaults typed controls as DialKit does", () => {
    expect(
      read({
        pick: { type: "select", options: [{ value: "a" }, { value: "b" }] },
        chosen: { type: "select", options: ["a", "b"], default: "b" },
        tint: { type: "color" },
        note: { type: "text" },
      }),
    ).toEqual({ pick: "a", chosen: "b", tint: "#000000", note: "" });
  });

  it("snaps a pad to its step and centres a missing axis", () => {
    expect(read({ at: { type: "pad", x: [0.123, -1, 1, 0.01] } })).toEqual({ at: { x: 0.12, y: 0 } });
  });

  it("resolves folders and drops the collapsed flag", () => {
    expect(read({ hero: { _collapsed: true, gap: [8, 0, 20], inner: { z: 1 } } })).toEqual({ hero: { gap: 8, inner: { z: 1 } } });
  });
});

describe("the rest of the stub", () => {
  it("draws nothing and holds no panels", () => {
    let ctl: { values: unknown } | undefined;
    const Probe = () => {
      ctl = useDialKitController("test", { a: [1, 0, 2] });
      return null;
    };
    renderToString(createElement(Probe));
    expect(ctl?.values).toEqual({ a: 1 });
    expect(DialRoot()).toBeNull();
    expect(DialStore.getPanels()).toEqual([]);
  });
});
