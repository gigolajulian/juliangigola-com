import { expect, test } from "vitest";
import { keep } from "./keep";

test("joins the pairs, and only them", () => {
  expect(keep("San Jose and the Bay Area, 90 minutes")).toBe("San\u00a0Jose and the Bay\u00a0Area, 90\u00a0minutes");
  expect(keep("San Francisco, South Bay, Silicon Valley, 2 looks")).toBe("San\u00a0Francisco, South\u00a0Bay, Silicon\u00a0Valley, 2\u00a0looks");
  expect(keep("Sandra Jose, the bay area, 90 frames")).toBe("Sandra Jose, the bay area, 90 frames");
});
