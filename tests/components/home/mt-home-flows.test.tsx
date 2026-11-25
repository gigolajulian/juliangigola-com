import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/lib/leads/enquiry-action", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.reject(new Error("offline"))),
);

import { Home } from "@/components/home/home";
import { BOOK_ROWS, QUOTE_OPTS } from "@/lib/home/data";
import { HOME_DATA } from "@/lib/home/server";

/* Book online and By quote on the v4 home. Read through the DOM only,
   so a rename inside the components cannot hide a change in what the visitor gets. */
const pointer = (fine: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (q: string) =>
      ({
        matches: fine && q.includes("pointer: fine"),
        media: q,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
const book = () => document.querySelector<HTMLElement>('[data-mt="book"]')!;
const quote = () => document.querySelector<HTMLElement>('[data-mt="quote"]')!;
// only the four row buttons in Book online carry aria-pressed; the big button under them does not
const row = (i: number) => book().querySelectorAll<HTMLElement>("button[aria-pressed]")[i];

describe("v4 home: Book online and By quote", () => {
  afterEach(() => vi.restoreAllMocks());

  it("touch: the first tap on a row selects it, the second opens the booking", () => {
    pointer(false);
    render(<Home data={HOME_DATA} />);
    fireEvent.click(row(1));
    expect(row(1).getAttribute("aria-pressed")).toBe("true");
    expect(book().hasAttribute("data-open")).toBe(false);
    fireEvent.click(row(1));
    expect(book().hasAttribute("data-open")).toBe(true);
    expect(book().dataset.on).toBe(BOOK_ROWS[1].slug);
  });

  it("mouse: one click on a row opens the booking", () => {
    pointer(true);
    render(<Home data={HOME_DATA} />);
    fireEvent.click(row(2));
    expect(book().hasAttribute("data-open")).toBe(true);
    expect(book().dataset.on).toBe(BOOK_ROWS[2].slug);
  });

  it("By quote: every kind of work is a button that asks about it", () => {
    render(<Home data={HOME_DATA} />);
    const names = within(quote()).getAllByRole("button", { name: /^Inquire about/ }).map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(QUOTE_OPTS.map((o) => `Inquire about ${o.name.toLowerCase()}`));
  });
});
