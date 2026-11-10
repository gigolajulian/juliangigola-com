import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StripRail, useRail } from "@/components/strip/rail";
import type { Tick } from "@/components/strip/use-reader";

const ticks: Tick[] = [{ i: 0, word: "Cover" }, { i: 1 }, { i: 2, word: "Contact" }];

function Harness({ at, pageCount }: { at: number; pageCount?: boolean }) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const glide = React.useRef<(to: number) => void>(() => {});
  const aimed = React.useRef("");
  const [aim, setAim] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<number | null>(null);
  const [overAway, setOverAway] = React.useState<number | null>(null);
  const rail = useRail({
    scroller,
    ticks,
    at,
    aim,
    setAim,
    over,
    setOver,
    overAway,
    setOverAway,
    chapters: false,
    router: { push() {} },
    glide,
    aimed,
  });
  return (
    <>
      <div ref={scroller} />
      <StripRail rail={rail} stack at={at} ticks={ticks} cue={false} over={over} overAway={overAway} still aim={aim} pageCount={pageCount} />
    </>
  );
}

describe("StripRail", () => {
  it("says the position to a reader", () => {
    render(<Harness at={2} />);
    const bar = screen.getByRole("progressbar", { name: "Position" });
    expect(bar.getAttribute("aria-valuemax")).toBe("3");
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuetext")).toBe("Contact");
  });

  it("counts the screens with pageCount", () => {
    const { container } = render(<Harness at={1} pageCount />);
    expect(container.querySelector(".strip-count")?.textContent).toBe("02 / 03");
  });
});
