import { expect, test } from "vitest";
import { V4PAGES, V4PAGES_HEAD } from "@/lib/flags/v4pages";

// The head script as it ships (app/layout.tsx renders it), run against a fake tab.
const js = V4PAGES_HEAD;

function run(search: string, stored: Record<string, string> = {}) {
  const dataset: Record<string, string> = {};
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

test("every key is on when the tab has no choice of its own", () => {
  expect(run("")).toBe(V4PAGES);
});

test("?v4pages=0 keeps the inner pages off, and stays off for the tab", () => {
  const stored: Record<string, string> = {};
  expect(run("?v4pages=0", stored)).toBeUndefined();
  expect(run("", stored)).toBeUndefined();
});

test("a key list wins", () => {
  expect(run("?v4pages=snd")).toBe("snd");
});

test("?v4pages alone turns every key on", () => {
  expect(run("?v4pages")).toBe(V4PAGES);
});
