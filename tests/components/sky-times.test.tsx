import * as React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SkyTimes } from "@/components/booking/sky-times";

const day = ["10:00", "11:00", "14:00", "16:00", "17:00", "19:00"].map((t) => `2026-11-26T${t}:00-08:00`);

it("groups the times by part of the day, keeps the slot contract, and picks on tap", () => {
  const choose = vi.fn();
  render(<SkyTimes times={day} picked={960} length={180} ruler={false} choose={choose} />);
  expect(screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(["Morning", "Afternoon", "Evening"]);
  const four = screen.getByRole("button", { name: "4:00 PM" });
  expect(four.getAttribute("aria-pressed")).toBe("true");
  expect(four.hasAttribute("data-slot")).toBe(true);
  // the session runs 4 to 7: 5 PM is inside it, 7 PM is where it ends
  expect(screen.getByRole("button", { name: "5:00 PM" }).className).toBe("in");
  expect(screen.getByRole("button", { name: "7:00 PM" }).className).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "10:00 AM" }));
  expect(choose).toHaveBeenCalledWith(600);
});

it("the ruler puts every time on one track with the parts of the day under it", () => {
  const { container } = render(<SkyTimes times={day} picked={600} length={60} ruler choose={() => {}} />);
  expect(container.querySelectorAll("[data-slot]")).toHaveLength(6);
  expect([...container.querySelectorAll(".rl")].map((x) => [x.textContent, (x as HTMLElement).style.gridColumn])).toEqual([["Morning", "span 2"], ["Afternoon", "span 2"], ["Evening", "span 2"]]);
});
