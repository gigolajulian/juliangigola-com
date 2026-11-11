import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Card, clampW, ListResizer, Pill, Row, SideLink } from "@/components/leads/list";
import type { LeadSummary } from "@/lib/leads/leads";

const iso = new Date().toISOString();
const lead = (o: Partial<LeadSummary> = {}): LeadSummary => ({ id: "a", email: "ana@x.com", name: "Ana", stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso, unread: true, snippet: "Can we shoot in May?", ...o });

describe("leads/list", () => {
  it("Row shows who, the message and the next step", () => {
    const onClick = vi.fn();
    render(<Row l={lead()} on upcoming={false} onClick={onClick} />);
    const row = screen.getByRole("button");
    expect(row.getAttribute("aria-current")).toBe("true");
    expect(row.textContent).toContain("Ana");
    expect(row.textContent).toContain("Can we shoot in May?");
    expect(row.textContent).toContain("Reply");
    expect(screen.getByLabelText("New")).toBeTruthy();
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalled();
  });

  it("Row flags a stuck deposit, Card shows the quote", () => {
    render(<Row l={lead({ flags: ["stuck"] })} on={false} upcoming={false} onClick={() => {}} />);
    expect(screen.getByText(/Deposit stuck/)).toBeTruthy();
    render(<Card l={lead({ id: "b", quote: 2400 })} on={false} onClick={() => {}} />);
    expect(screen.getByText("$2,400")).toBeTruthy();
  });

  it("clampW keeps the list between 300 and 720", () => {
    expect(clampW(10)).toBe(300);
    expect(clampW(900)).toBe(720);
    expect(clampW(420.6)).toBe(421);
  });

  it("ListResizer moves with the arrow keys", () => {
    const onChange = vi.fn();
    render(<ListResizer w={420} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("separator", { name: "List width" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(436);
  });

  it("SideLink and Pill show their counts", () => {
    const onClick = vi.fn();
    render(<SideLink on n={3} onClick={onClick}>Your move</SideLink>);
    const link = screen.getByRole("button", { name: /Your move/ });
    expect(link.getAttribute("aria-pressed")).toBe("true");
    expect(link.textContent).toContain("3");
    render(<SideLink on={false} href="/admin">Site</SideLink>);
    expect(screen.getByRole("link", { name: "Site" }).getAttribute("href")).toBe("/admin");
    render(<Pill on={false} n={5} onClick={onClick}>Open</Pill>);
    fireEvent.click(screen.getByRole("button", { name: /Open/ }));
    expect(onClick).toHaveBeenCalled();
  });
});
