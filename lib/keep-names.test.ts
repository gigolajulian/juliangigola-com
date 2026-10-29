import { expect, test } from "vitest";
import { keepNames } from "./keep-names";

test("leaves a script without __name as it is", () => {
  expect(keepNames("(function(){})()")).toBe("(function(){})()");
});

test("gives a script with __name a pass-through that runs", () => {
  const js = keepNames('window.r=__name(function(){return 7},"f")()');
  const w: { r?: number } = {};
  new Function("window", js)(w);
  expect(w.r).toBe(7);
});
