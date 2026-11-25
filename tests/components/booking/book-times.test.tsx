import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";

const seen = vi.hoisted(() => ({ mounts: 0 }));
vi.mock("@/components/booking/picker/time-picker", () => ({
  TimePicker: ({ path, fallback }: { path: string; fallback: React.ReactNode }) => {
    seen.mounts++;
    return (
      <div data-testid="tp" data-path={path}>
        {fallback}
      </div>
    );
  },
}));

import { BookTimes } from "@/components/booking/book-times";
import type { StepsSkin } from "@/components/booking/picker/parts";

const skin: StepsSkin = { name: "Portraits", from: null, shell: () => null };

describe("BookTimes", () => {
  it("mounts the picker with a way out when times fail", () => {
    render(<BookTimes path="juliangigola/portraits" title="Pick a time" skin={skin} />);
    expect(screen.getByTestId("tp").getAttribute("data-path")).toBe("juliangigola/portraits");
    expect(screen.getByRole("alert").textContent).toMatch(/Times didn.t load/);
    expect(screen.getByRole("link", { name: "Inquire" }).getAttribute("href")).toBe("/contact/form");
    expect(screen.getByRole("link", { name: "hello@juliangigola.com" }).getAttribute("href")).toBe("mailto:hello@juliangigola.com");
  });

  it("Try again mounts a fresh picker", () => {
    render(<BookTimes path="juliangigola/portraits" title="Pick a time" skin={skin} />);
    const before = seen.mounts;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(seen.mounts).toBeGreaterThan(before);
  });
});
