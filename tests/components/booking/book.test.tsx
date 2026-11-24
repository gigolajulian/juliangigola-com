import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/leads/enquiry-action", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
// jsdom has no modal dialogs.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};

const cover = vi.hoisted(() => vi.fn());
vi.mock("@/components/splash/jg-cover", () => ({ JG_COVER: "", mountCover: cover }));

import { CallDialog, SessionBook, BookFlow } from "@/components/booking/book";

describe("SessionBook", () => {
  it("weddings is on request: the date step with the page's own heading", () => {
    render(<SessionBook slug="weddings" />);
    expect(screen.getByRole("heading", { level: 1, name: "Book a session" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Steps" }).textContent).toContain("Shoot");
  });

  it("a Cal session mounts the time picker shell", () => {
    const { container } = render(<BookFlow slug="portraits" tabs={false} />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe("session tabs carry intent to the next page once", () => {
  const radios = () => screen.getAllByRole("radio");

  it("a picked tab skips the cover on the page it opens, and only there", () => {
    cover.mockClear();
    const a = render(<SessionBook slug="portraits" />);
    expect(cover).toHaveBeenCalledTimes(1); // a move in from elsewhere puts the cover up
    const next = radios()[1];
    fireEvent.click(next);
    a.unmount();
    cover.mockClear();
    const b = render(<SessionBook slug="headshots" />);
    expect(cover).not.toHaveBeenCalled(); // the tab's page keeps the J and G
    b.unmount();
    render(<SessionBook slug="graduation" />);
    expect(cover).toHaveBeenCalledTimes(1); // the flag was read once: a later page covers again
  });

  it("a tile picked by key takes the focus on its own page, once", () => {
    const a = render(<SessionBook slug="portraits" />);
    const group = screen.getByRole("radiogroup", { name: "Session" });
    fireEvent.keyDown(group, { key: "ArrowRight" });
    a.unmount();
    const b = render(<SessionBook slug="headshots" />); // the next tile after Portraits
    expect(document.activeElement).toBe(screen.getByRole("radio", { checked: true }));
    expect(document.activeElement?.textContent).toContain("Headshots");
    b.unmount();
    render(<SessionBook slug="headshots" />);
    expect(document.activeElement).toBe(document.body);
  });
});

describe("CallDialog", () => {
  it("opens the consultation over the page instead of navigating", () => {
    render(<CallDialog />);
    const link = screen.getByRole("link", { name: "Schedule a call" });
    expect(fireEvent.click(link)).toBe(false);
    expect(document.querySelector("dialog.calldlg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });
});
