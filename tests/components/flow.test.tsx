import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/contact/actions", () => ({ submitEnquiry: vi.fn() }));
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

import { Calendar, Failed, Field, FlowShell, Hidden, Run, checkYou, first, fmt, iso, monthCells, weekCells } from "@/components/v3/flow";

describe("flow helpers", () => {
  it("formats dates and times", () => {
    expect(iso(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(fmt(0)).toBe("12:00 AM");
    expect(fmt(13 * 60 + 5)).toBe("1:05 PM");
    expect(first("  Ana Maria ")).toBe("Ana");
  });

  it("builds month and week cells Monday first", () => {
    const m = monthCells(new Date(2026, 10, 10)); // Nov 2026 starts on a Sunday
    expect(m.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(m[6]?.getDate()).toBe(1);
    const w = weekCells(new Date(2026, 10, 11));
    expect(w).toHaveLength(7);
    expect(w[0].getDay()).toBe(1);
  });

  it("checkYou flags a missing name and a bad email", () => {
    expect(checkYou("", "x")).toEqual({ name: "Add your name", email: "Email looks incomplete" });
    expect(checkYou("Ana", "ana@example.com")).toEqual({});
  });
});

describe("flow parts", () => {
  it("Run puts a dot after every item but the last", () => {
    render(<Run items={["One", "Two"]} />);
    expect(screen.getByText("One ·")).toBeTruthy();
    expect(screen.getByText("Two")).toBeTruthy();
  });

  it("Field types through and shows its error", () => {
    const onChange = vi.fn();
    render(<Field k="name" label="Name" value="" onChange={onChange} err="Add your name" req />);
    const input = document.getElementById("f-name")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(input, { target: { value: "Ana" } });
    expect(onChange).toHaveBeenCalledWith("Ana");
    expect(screen.getByRole("alert").textContent).toBe("Add your name");
  });

  it("Failed shows the error with a mail link, nothing otherwise", () => {
    const { container } = render(<Failed state={{ status: "idle" } as never} />);
    expect(container.innerHTML).toBe("");
    render(<Failed state={{ status: "error", message: "Could not send", mailto: "mailto:x@y.z" } as never} />);
    expect(screen.getByRole("link", { name: "Open in your mail app" }).getAttribute("href")).toBe("mailto:x@y.z");
  });

  it("Hidden carries the type and the honeypot", () => {
    const { container } = render(<form><Hidden type="note" detail="Diesel" /></form>);
    expect(container.querySelector('input[name="type"]')?.getAttribute("value")).toBe("note");
    expect(container.querySelector('input[name="company"]')).toBeTruthy();
  });

  it("Calendar picks a day and switches view", () => {
    const onPick = vi.fn();
    const setView = vi.fn();
    render(<Calendar view="week" setView={setView} anchor={new Date(2026, 10, 11)} shift={() => {}} canBack={false} picked="" tag={(d) => (d.getDay() === 0 ? null : "3 open")} onPick={onPick} />);
    expect((screen.getByRole("button", { name: "Earlier" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(setView).toHaveBeenCalledWith("month");
    fireEvent.click(document.querySelector('[data-day="2026-11-11"]')!);
    expect(onPick).toHaveBeenCalled();
    expect((document.querySelector('[data-day="2026-11-15"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it("FlowShell draws the rail, the head and the summary", () => {
    render(<FlowShell steps={["Date", "You"]} at={1} head="Pick a day" body={<p>body</p>} photo={{ d: "/a.jpg", l: "/b.jpg" }} name="Portraits" sum={[["Session", "$100 deposit"]]} h1 />);
    expect(screen.getByRole("heading", { level: 1, name: "Pick a day" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Steps" }).querySelector('[aria-current="step"]')?.textContent).toContain("Date");
    expect(screen.getByText("$100 deposit")).toBeTruthy();
  });
});
