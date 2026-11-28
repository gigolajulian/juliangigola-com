import { expect, test } from "vitest";
import { DS_HEAD } from "@/lib/flags/ds";

// The head script as it ships (app/layout.tsx renders it), run against a fake tab.
function run(search: string, stored: Record<string, string> = {}) {
  const dataset: Record<string, string> = {};
  const sessionStorage = {
    getItem: (k: string) => (k in stored ? stored[k] : null),
    setItem: (k: string, v: string) => void (stored[k] = v),
  };
  new Function("location", "sessionStorage", "document", DS_HEAD)({ search }, sessionStorage, { documentElement: { dataset } });
  return "ds" in dataset;
}

test("off when the tab has made no choice", () => {
  expect(run("")).toBe(false);
  expect(run("?dsx=1")).toBe(false);
});

test("?ds and ?ds=1 turn it on, and it stays on for the tab", () => {
  const stored: Record<string, string> = {};
  expect(run("?ds", stored)).toBe(true);
  expect(run("", stored)).toBe(true);
  expect(run("?a=b&ds=1")).toBe(true);
});

test("?ds=0 turns it off again", () => {
  const stored = { "jg-ds": "1" };
  expect(run("?ds=0", stored)).toBe(false);
  expect(run("", stored)).toBe(false);
});

test("storage that throws leaves the flag off", () => {
  const dataset: Record<string, string> = {};
  const boom = {
    getItem: () => {
      throw new Error("no");
    },
    setItem: () => {
      throw new Error("no");
    },
  };
  new Function("location", "sessionStorage", "document", DS_HEAD)({ search: "?ds" }, boom, { documentElement: { dataset } });
  expect("ds" in dataset).toBe(false);
});
