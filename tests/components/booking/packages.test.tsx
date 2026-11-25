import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/site/foot", () => ({ PageFoot: () => null }));

import { Packages } from "@/components/booking/packages";
import { FlowShell } from "@/components/enquiry/flow";
import { SESSIONS } from "@/lib/booking/catalog";
import { DEPOSIT } from "@/lib/leads/deposit-terms";

describe("/book package cards", () => {
  it("lists the priced sessions cheapest first, each with its own deposit and a link to its calendar", () => {
    render(<Packages />);
    const cards = [...document.querySelectorAll(".pk-c")];
    const prices = cards.map((c) => Number(/\$(\d+)/.exec(c.querySelector("h2")!.textContent!)![1]));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(cards).toHaveLength(4);
    // studio-digitals books the `digitals` event: its deposit is that event's, not the legacy $100
    const digitals = cards.find((c) => c.textContent!.includes(SESSIONS["studio-digitals"].name))!;
    expect(digitals.querySelector(".pk-dl")!.textContent).toContain(`$${DEPOSIT.digitals}`);
    expect(screen.getByRole("link", { name: "Book studio digitals" }).getAttribute("href")).toBe("/book/studio-digitals");
    expect(screen.getByRole("list", { name: "Steps" }).querySelector('[aria-current="step"]')?.textContent).toContain("Session");
  });

  it("FlowShell puts a lead step first in the rail and numbers its own steps after it", () => {
    render(
      <FlowShell
        steps={["Time", "You"]}
        at={1}
        head="Pick a time"
        body={null}
        photo={{ d: "/a.jpg", l: "/b.jpg" }}
        name="Portraits"
        sum={[]}
        lead={{ name: "Session", href: "/book" }}
      />,
    );
    const rail = screen.getByRole("list", { name: "Steps" });
    expect([...rail.children].map((l) => l.textContent!.replace(/\s+/g, " ").trim())).toEqual(["01 Session", "02 Time", "03 You"]);
    expect(rail.querySelector("a")?.getAttribute("href")).toBe("/book");
    expect(rail.querySelector('[aria-current="step"]')?.textContent).toContain("Time");
  });
});
