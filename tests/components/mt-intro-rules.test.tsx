import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { returning, shouldPlay } from "@/components/home/intro";

/* The v4 home intro's play rules, as they stand: which timing a visitor gets (returning)
   and whether it plays at all (shouldPlay). Read from the URL,
   local storage and session storage, so each case sets those and nothing else. */
const DAY = 864e5;
const at = (q: string) => history.replaceState(null, "", `/${q}`);
const root = document.documentElement;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  at("");
});

afterEach(() => {
  delete root.dataset.mtLate;
});

describe("returning: the short intro for a browser that saw it in the last 30 days", () => {
  it("is false with no stamp", () => {
    expect(returning()).toBe(false);
  });

  it("is true for a stamp from 29 days ago and false for one from 31 days ago", () => {
    localStorage.setItem("jg-intro-at", String(Date.now() - 29 * DAY));
    expect(returning()).toBe(true);
    localStorage.setItem("jg-intro-at", String(Date.now() - 31 * DAY));
    expect(returning()).toBe(false);
  });

  it("?intro=2 asks for the short one", () => {
    at("?intro=2");
    expect(returning()).toBe(true);
  });

  it("?intro=1 asks for the full one, even with a fresh stamp", () => {
    localStorage.setItem("jg-intro-at", String(Date.now()));
    at("?intro=1");
    expect(returning()).toBe(false);
  });
});

describe("shouldPlay: whether the intro runs on this load", () => {
  it("plays by default", () => {
    expect(shouldPlay()).toBe(true);
  });

  it("?intro=0 turns it off", () => {
    at("?intro=0");
    expect(shouldPlay()).toBe(false);
  });

  it("does not play once the head script gave the page back (mtLate)", () => {
    root.dataset.mtLate = "";
    expect(shouldPlay()).toBe(false);
  });

  it("plays once a session, and ?intro=1 plays it again", () => {
    sessionStorage.setItem("jg-intro", "1");
    expect(shouldPlay()).toBe(false);
    at("?intro=1");
    expect(shouldPlay()).toBe(true);
  });
});
