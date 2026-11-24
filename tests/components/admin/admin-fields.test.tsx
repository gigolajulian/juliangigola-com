import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ContactFields, QuoteFields, SessionFields } from "@/components/admin/editor/fields";
import { CONTENT, type SiteContent } from "@/lib/content";

/* `components/admin/editor/fields.tsx`: the editor's text panels write the
   draft through `set`, in the draft's own shape. */

const draft = (over: Partial<SiteContent> = {}): SiteContent => ({ ...CONTENT, ...over });
const session = CONTENT.sessions[0];

describe("SessionFields", () => {
  it("an empty price reads as On request (null), a number stays a number", () => {
    const set = vi.fn();
    render(<SessionFields draft={draft({ sessions: [{ ...session, from: 400 }] })} set={set} />);
    const price = screen.getByLabelText(/Starting price/);
    fireEvent.change(price, { target: { value: "" } });
    expect(set).toHaveBeenLastCalledWith("sessions", [{ ...session, from: null }]);
    fireEvent.change(price, { target: { value: "650" } });
    expect(set).toHaveBeenLastCalledWith("sessions", [{ ...session, from: 650 }]);
  });

  it("What's included is one per line, blank lines dropped", () => {
    const set = vi.fn();
    render(<SessionFields draft={draft({ sessions: [session] })} set={set} />);
    fireEvent.change(screen.getByLabelText(/What's included/), { target: { value: " 20 frames \n\n Retouching " } });
    expect(set).toHaveBeenLastCalledWith("sessions", [{ ...session, includes: ["20 frames", "Retouching"] }]);
  });
});

describe("QuoteFields", () => {
  const quotes = [
    { quote: "Fast.", name: "Ana" },
    { quote: "Sharp.", name: "Bo", role: "AD" },
  ];

  it("Add a quote appends an empty one, Remove drops that one only", () => {
    const set = vi.fn();
    render(<QuoteFields draft={draft({ testimonials: quotes })} set={set} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a quote" }));
    expect(set).toHaveBeenLastCalledWith("testimonials", [...quotes, { quote: "", name: "" }]);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(set).toHaveBeenLastCalledWith("testimonials", [quotes[1]]);
  });

  it("an emptied role is dropped rather than kept as an empty string", () => {
    const set = vi.fn();
    render(<QuoteFields draft={draft({ testimonials: quotes })} set={set} />);
    fireEvent.change(screen.getAllByPlaceholderText("Art Director, WIRED")[1], { target: { value: "" } });
    expect(set).toHaveBeenLastCalledWith("testimonials", [quotes[0], { quote: "Sharp.", name: "Bo", role: undefined }]);
  });
});

describe("ContactFields", () => {
  it("an emptied reply time or booking link is saved as null", () => {
    const set = vi.fn();
    render(<ContactFields draft={draft({ responseTime: "within a day", bookingUrl: "https://calendar.app.google/x" })} set={set} />);
    fireEvent.change(screen.getByLabelText(/Reply-time promise/), { target: { value: "" } });
    expect(set).toHaveBeenLastCalledWith("responseTime", null);
    fireEvent.change(screen.getByLabelText(/Booking link/), { target: { value: "" } });
    expect(set).toHaveBeenLastCalledWith("bookingUrl", null);
    expect(document.getElementById("field-bookingUrl")).toBeTruthy();
  });
});
