import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("dialkit", () => ({
  DialStore: {
    getPanels: () => [{ id: "book-card", name: "Booking card" }],
    getValues: () => ({ width: 2.2, "width.__mode": "x" }),
  },
}));
vi.mock("@/lib/arrange-notes", () => ({ notesText: () => "" }));

import { DialCopyAll, copyText } from "@/components/dial-copy-all";

describe("DialCopyAll", () => {
  it("copyText writes every panel, modes left out", () => {
    const text = copyText();
    expect(text).toContain('"Booking card" (book-card):');
    expect(text).toContain('"width": 2.2');
    expect(text).not.toContain("__mode");
  });

  it("renders nothing without DialKit's header", () => {
    const { container } = render(<DialCopyAll />);
    expect(container.innerHTML).toBe("");
  });

  it("puts its button in DialKit's header", () => {
    const root = document.createElement("div");
    root.className = "dialkit-folder-root";
    const header = document.createElement("div");
    header.className = "dialkit-panel-header";
    root.append(header);
    document.body.append(root);
    render(<DialCopyAll />);
    expect(screen.getByRole("button", { name: "Copy all" }).parentElement).toBe(header);
    root.remove();
  });
});
