import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/leads/enquiry-action", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.reject(new Error("offline"))),
);
// ReferencePicks touches these on mount; jsdom has neither.
Element.prototype.scrollTo = () => {};
const emptyFiles = () => Object.assign(document.createElement("input"), { type: "file" }).files;
vi.stubGlobal(
  "DataTransfer",
  class {
    items = { add() {} };
    files = emptyFiles();
  },
);

import { CommissionForm, Contact } from "@/components/contact/inquire";

describe("Contact", () => {
  it("renders the note and the call card", () => {
    render(<Contact />);
    expect(screen.getByRole("heading", { level: 1, name: "Get in touch" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Book a consultation" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Schedule a call" }).getAttribute("href")).toBe("/book/consultation");
  });

  it("an empty note shows its errors instead of sending", () => {
    render(<Contact />);
    fireEvent.click(screen.getByRole("button", { name: "Send note" }));
    const alerts = screen.getAllByRole("alert").map((a) => a.textContent);
    expect(alerts).toContain("Add your name");
    expect(alerts).toContain("Email looks incomplete");
  });
});

describe("CommissionForm", () => {
  it("starts on the Project step", () => {
    render(<CommissionForm />);
    expect(screen.getByRole("list", { name: "Steps" }).querySelector('[aria-current="step"]')?.textContent).toContain("Project");
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  });
});
