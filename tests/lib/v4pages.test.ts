import { expect, test } from "vitest";
import { V4PAGES, V4PAGES_HEAD } from "@/lib/flags/v4pages";

// The head script as it ships (app/layout.tsx renders it), run against a fake tab.
const js = V4PAGES_HEAD;

function run(search: string, v4home: boolean, stored: Record<string, string> = {}) {
  const dataset: Record<string, string> = v4home ? { mtscroll: "" } : {};
  const sessionStorage = {
    getItem: (k: string) => (k in stored ? stored[k] : null),
    setItem: (k: string, v: string) => void (stored[k] = v),
  };
  new Function("location", "sessionStorage", "document", js)({ search }, sessionStorage, { documentElement: { dataset } });
  return dataset.v4pages;
}

test("the script and lib/flags/v4pages.ts list the same keys", () => {
  expect(js).toContain(`all="${V4PAGES}"`);
});

test("without the V4 home no trial is on", () => {
  expect(run("", false)).toBeUndefined();
});

test("follows the V4 home when the tab has no choice of its own", () => {
  expect(run("", true)).toBe(V4PAGES.replace(" tilt", "")); // tilt stays opt-in, it is still on trial
});

test("?v4pages=0 keeps the inner pages off under the V4 home, and stays off for the tab", () => {
  const stored: Record<string, string> = {};
  expect(run("?v4pages=0", true, stored)).toBeUndefined();
  expect(run("", true, stored)).toBeUndefined();
});

test("a key list wins over the V4 home", () => {
  expect(run("?v4pages=tilt", true)).toBe("tilt");
});

test("?v4pages alone still turns every key on", () => {
  expect(run("?v4pages", false)).toBe(V4PAGES);
});
