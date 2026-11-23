import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/lib/leads/enquiry-action", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
// no frames: with every jsdom rect 0 the films row reads its place as NaN on the next frame
vi.stubGlobal("requestAnimationFrame", () => 0);

import { Home } from "@/components/v4/home/home";
import { BOOK_ROWS, QUOTE_OPTS } from "@/lib/v4-home/data";
import { HOME_DATA } from "@/lib/v4-home/server";

/* A card opened from a footer link hands focus back to that link when it closes.
   fireEvent.click does not focus the button, like a click in Safari, so the link is not the active element at open. */
const foot = () => within(document.querySelector<HTMLElement>("footer#contact")!);

describe("v4 home footer: focus comes back to the opener", () => {
  afterEach(() => vi.restoreAllMocks());

  it("Inquire link: Esc closes the inquiry card and the link has focus", async () => {
    render(<Home data={HOME_DATA} />);
    const link = foot().getByRole("button", { name: QUOTE_OPTS[0].name });
    fireEvent.click(link);
    // the card's code is imported on first use, so it mounts a moment after the click
    const card = await waitFor(() => {
      const c = document.querySelector<HTMLElement>(".mt-inq");
      expect(c).not.toBeNull();
      return c!;
    }, { timeout: 15000 }); // a cold import under a full parallel run can pass 5s
    await waitFor(() => expect(card.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(card, { key: "Escape" });
    expect(document.querySelector(".mt-inq")).toBeNull();
    // Radix hands focus back a task after the card unmounts
    await waitFor(() => expect(document.activeElement).toBe(link));
  }, 20000);

  it("Book online link: Back closes the booking, the link has focus and the page does not scroll to Sessions", () => {
    render(<Home data={HOME_DATA} />);
    const link = foot().getByRole("button", { name: BOOK_ROWS[0].name });
    fireEvent.click(link);
    const book = document.querySelector<HTMLElement>('[data-mt="book"]')!;
    expect(book.hasAttribute("data-open")).toBe(true);
    // jsdom's focus() does not scroll, so this checks the scroll to Sessions is skipped; the scroll back to the link is the browser's own
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    fireEvent.click(within(book).getByRole("button", { name: "Back" }));
    expect(document.activeElement).toBe(link);
    expect(scroll).not.toHaveBeenCalled();
  });
});
