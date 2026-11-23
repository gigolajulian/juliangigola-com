import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/lib/leads/enquiry-action", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

import { Home } from "@/components/v4/home/home";
import { BOOK_ROWS, QUOTE_OPTS } from "@/lib/v4-home/data";
import { MT } from "@/lib/v4-home/server";

/* The two lists on the v4 home that talk to each other: Book online and By quote. Read through the DOM only,
   so a rename inside the components cannot hide a change in what the visitor gets. */
const pointer = (fine: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (q: string) => ({ matches: fine && q.includes("pointer: fine"), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList,
  );
const book = () => document.querySelector<HTMLElement>('[data-mt="book"]')!;
const quote = () => document.querySelector<HTMLElement>('[data-mt="quote"]')!;
// only the four row buttons in Book online carry aria-pressed; the big button under them does not
const row = (i: number) => book().querySelectorAll<HTMLElement>("button[aria-pressed]")[i];
// the "on" class is the only state marker on the By quote photos, so it stays the one class this test reads
const quotePhoto = () => QUOTE_OPTS.findIndex((o) => within(book()).getByAltText(`${o.name} sample`).classList.contains("on"));

describe("v4 home: Book online and By quote", () => {
  afterEach(() => vi.restoreAllMocks());

  it("touch: the first tap on a row selects it, the second opens the booking", () => {
    pointer(false);
    render(<Home data={MT} />);
    fireEvent.click(row(1));
    expect(row(1).getAttribute("aria-pressed")).toBe("true");
    expect(book().hasAttribute("data-open")).toBe(false);
    fireEvent.click(row(1));
    expect(book().hasAttribute("data-open")).toBe(true);
    expect(book().dataset.on).toBe(BOOK_ROWS[1].slug);
  });

  it("mouse: one click on a row opens the booking", () => {
    pointer(true);
    render(<Home data={MT} />);
    fireEvent.click(row(2));
    expect(book().hasAttribute("data-open")).toBe(true);
    expect(book().dataset.on).toBe(BOOK_ROWS[2].slug);
  });

  it("picking a By quote option shows its photo in Book online; touching a Book online row takes it back", () => {
    pointer(false);
    render(<Home data={MT} />);
    expect(quotePhoto()).toBe(-1);
    // pressed: false leaves out the Inquire buttons, which have no aria-pressed
    fireEvent.click(within(quote()).getByRole("button", { name: new RegExp(QUOTE_OPTS[1].name), pressed: false }));
    expect(quotePhoto()).toBe(1);
    fireEvent.click(row(2));
    expect(quotePhoto()).toBe(-1);
  });
});
