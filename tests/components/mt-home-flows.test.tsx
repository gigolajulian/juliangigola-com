import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/app/contact/actions", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

import { MtHome } from "@/components/v3/mt/home";
import { BOOK_ROWS, QUOTE_OPTS } from "@/components/v3/mt/data";
import { MT } from "@/lib/mt-home-data";

/* The two lists on the v4 home that talk to each other: Book online and By quote. Read through the DOM only,
   so a rename inside the components cannot hide a change in what the visitor gets. */
const pointer = (fine: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (q: string) => ({ matches: fine && q.includes("pointer: fine"), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList,
  );
const book = () => document.querySelector<HTMLElement>(".mt-book")!;
const row = (i: number) => book().querySelectorAll<HTMLElement>(".mt-brw button[aria-pressed]")[i];
const quotePhoto = () => [...book().querySelectorAll("img.qp")].findIndex((img) => img.classList.contains("on"));

describe("v4 home: Book online and By quote", () => {
  afterEach(() => vi.restoreAllMocks());

  it("touch: the first tap on a row selects it, the second opens the booking", () => {
    pointer(false);
    render(<MtHome data={MT} />);
    fireEvent.click(row(1));
    expect(row(1).getAttribute("aria-pressed")).toBe("true");
    expect(book().hasAttribute("data-open")).toBe(false);
    fireEvent.click(row(1));
    expect(book().hasAttribute("data-open")).toBe(true);
    expect(book().dataset.on).toBe(BOOK_ROWS[1].key);
  });

  it("mouse: one click on a row opens the booking", () => {
    pointer(true);
    render(<MtHome data={MT} />);
    fireEvent.click(row(2));
    expect(book().hasAttribute("data-open")).toBe(true);
    expect(book().dataset.on).toBe(BOOK_ROWS[2].key);
  });

  it("picking a By quote option shows its photo in Book online; touching a Book online row takes it back", () => {
    pointer(false);
    render(<MtHome data={MT} />);
    expect(quotePhoto()).toBe(-1);
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(QUOTE_OPTS[1].name) }).find((b) => b.classList.contains("mt-qo"))!);
    expect(quotePhoto()).toBe(1);
    fireEvent.click(row(2));
    expect(quotePhoto()).toBe(-1);
  });
});
