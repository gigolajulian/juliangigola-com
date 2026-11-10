import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("dialkit", () => ({
  DialRoot: () => null,
  useDialKit: (_: string, spec: Record<string, number[]>) =>
    Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, v[0]])),
}));
vi.mock("@/lib/dialkit-styles", () => ({ useDialKitStyles: () => {} }));
vi.mock("@/components/booking/cal-embed", () => ({
  CalEmbed: ({ path, title }: { path: string; title: string }) => (
    <div data-testid="cal" data-path={path}>
      {title}
    </div>
  ),
}));
vi.mock("@/components/inquire-wall", () => ({ InquireWall: () => null }));
vi.mock("@/components/dial-copy-all", () => ({ DialCopyAll: () => null }));

import { BookPicker, type Bookable } from "@/components/booking/book-picker";

const sessions: Bookable[] = [
  { slug: "portraits", name: "Portraits", blurb: "One look.", rate: "$100 deposit", length: "1 hr", cal: "juliangigola/portraits", wall: [] },
  { slug: "headshots", name: "Headshots", blurb: "Clean frames.", rate: "$100 deposit", length: "45 min", cal: "juliangigola/headshots", wall: [] },
];

describe("BookPicker", () => {
  it("opens on the session named by start", () => {
    render(<BookPicker sessions={sessions} start="headshots" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Book a session");
    expect(screen.getByRole("button", { name: /Headshots/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("cal").getAttribute("data-path")).toBe("juliangigola/headshots");
    expect(screen.getByRole("link", { name: "Inquire" }).getAttribute("href")).toBe("/#contact");
  });

  it("switches the calendar and the address on a pick", () => {
    render(<BookPicker sessions={sessions} />);
    expect(screen.getByTestId("cal").getAttribute("data-path")).toBe("juliangigola/portraits");
    fireEvent.click(screen.getByRole("button", { name: /Headshots/ }));
    expect(screen.getByTestId("cal").textContent).toBe("Pick a time for Headshots");
    expect(new URLSearchParams(location.search).get("session")).toBe("headshots");
  });
});
