import * as React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SkyTimes } from "@/components/booking/picker/sky-times";
import { Calendar } from "@/components/booking/flow";

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

it("a visitor on another clock gets San Jose's parts of the day, named so", () => {
  // 10 AM Pacific shown on a New York clock: 1 PM there, still San Jose's morning light
  render(<SkyTimes times={["2026-11-26T13:00:00-05:00", "2026-11-26T21:00:00-05:00"]} picked={780} length={60} ruler={false} choose={() => {}} />);
  expect(screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(["Morning in San Jose", "Evening in San Jose"]);
});

it("past a dozen times the ruler turns into rows", () => {
  const half = Array.from({ length: 20 }, (_, k) => `2026-11-26T${String(10 + Math.floor(k / 2)).padStart(2, "0")}:${k % 2 ? "30" : "00"}:00-08:00`);
  const { container } = render(<SkyTimes times={half} picked={600} length={30} ruler choose={() => {}} />);
  expect(container.querySelector(".sky-ruler")).toBeNull();
  expect(container.querySelector(".sky-rows")).not.toBeNull();
});

it("the sky week shows the days it is given, each under its own weekday; without them, Monday to Sunday", () => {
  const props = { view: "week" as const, setView: () => {}, anchor: new Date(2026, 10, 24), shift: () => {}, canBack: false, picked: "2026-11-26", tag: () => "1 open", onPick: () => {} };
  const strip = [26, 28, 29].map((d) => new Date(2026, 10, d)).concat(new Date(2026, 11, 2), new Date(2026, 11, 3));
  const { container, rerender } = render(<Calendar {...props} strip={strip} parts={() => [true, true, true]} />);
  expect([...container.querySelectorAll(".wd")].map((x) => x.textContent)).toEqual(["Thu", "Sat", "Sun", "Wed", "Thu"]);
  expect([...container.querySelectorAll("[data-day]")].map((x) => x.getAttribute("data-day"))).toEqual(["2026-11-26", "2026-11-28", "2026-11-29", "2026-12-02", "2026-12-03"]);
  expect(container.querySelector(".cal-top span")?.textContent).toBe("November – December 2026");
  rerender(<Calendar {...props} />);
  expect(container.querySelectorAll("[data-day]")).toHaveLength(7);
});
