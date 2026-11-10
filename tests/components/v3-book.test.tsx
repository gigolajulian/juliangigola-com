import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/contact/actions", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
// jsdom has no modal dialogs.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};

import { CallDialog, V3Book, V3BookFlow } from "@/components/v3/book";

describe("V3Book", () => {
  it("weddings is on request: the date step with the page's own heading", () => {
    render(<V3Book slug="weddings" />);
    expect(screen.getByRole("heading", { level: 1, name: "Book a session" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Steps" }).textContent).toContain("Shoot");
  });

  it("a Cal session mounts the time picker shell", () => {
    const { container } = render(<V3BookFlow slug="portraits" tabs={false} />);
    expect(container.firstChild).toBeTruthy();
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
