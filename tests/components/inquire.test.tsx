import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/contact/actions", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
// ReferencePicks touches these on mount; jsdom has neither.
Element.prototype.scrollTo = () => {};
const emptyFiles = () => Object.assign(document.createElement("input"), { type: "file" }).files;
vi.stubGlobal("DataTransfer", class { items = { add() {} }; files = emptyFiles(); });

import { V3Commission, V3Inquire } from "@/components/v3/inquire";

describe("V3Inquire", () => {
  it("renders the note and the call card", () => {
    render(<V3Inquire />);
    expect(screen.getByRole("heading", { level: 1, name: "Get in touch" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Book a consultation" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Schedule a call" }).getAttribute("href")).toBe("/book/consultation");
  });

  it("an empty note shows its errors instead of sending", () => {
    render(<V3Inquire />);
    fireEvent.click(screen.getByRole("button", { name: "Send note" }));
    const alerts = screen.getAllByRole("alert").map((a) => a.textContent);
    expect(alerts).toContain("Add your name");
    expect(alerts).toContain("Email looks incomplete");
  });
});

describe("V3Commission", () => {
  it("starts on the Project step", () => {
    render(<V3Commission />);
    expect(screen.getByRole("list", { name: "Steps" }).querySelector('[aria-current="step"]')?.textContent).toContain("Project");
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  });
});
