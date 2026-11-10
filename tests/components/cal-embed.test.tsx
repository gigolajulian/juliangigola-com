import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";

const seen = vi.hoisted(() => ({ mounts: 0 }));
vi.mock("@/components/time-picker", () => ({
  TimePicker: ({ path, fallback }: { path: string; fallback: React.ReactNode }) => {
    seen.mounts++;
    return (
      <div data-testid="tp" data-path={path}>
        {fallback}
      </div>
    );
  },
}));

import { CalEmbed } from "@/components/cal-embed";

describe("CalEmbed", () => {
  it("mounts the picker with a way out when times fail", () => {
    render(<CalEmbed path="juliangigola/portraits" title="Pick a time" />);
    expect(screen.getByTestId("tp").getAttribute("data-path")).toBe("juliangigola/portraits");
    expect(screen.getByRole("alert").textContent).toMatch(/Times didn.t load/);
    expect(screen.getByRole("link", { name: "Inquire" }).getAttribute("href")).toBe("/#contact");
    expect(screen.getByRole("link", { name: "hello@juliangigola.com" }).getAttribute("href")).toBe("mailto:hello@juliangigola.com");
  });

  it("Try again mounts a fresh picker", () => {
    render(<CalEmbed path="juliangigola/portraits" title="Pick a time" />);
    const before = seen.mounts;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(seen.mounts).toBeGreaterThan(before);
  });
});
