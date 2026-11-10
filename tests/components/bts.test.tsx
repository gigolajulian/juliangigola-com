import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BtsCredit, BtsPageGrid, BtsStripGrid } from "@/components/bts";
import type { Bts } from "@/lib/work-types";

const bts: Bts = {
  by: "someone",
  frames: [
    { src: "/work/x/bts-01.jpg", width: 800, height: 600, color: "#111", alt: "" },
    { src: "/work/x/bts-02.jpg", width: 800, height: 600, color: "#222", alt: "Set light" },
    { src: "/work/x/bts-03.mp4", width: 720, height: 1280, color: "#333", alt: "" },
  ],
};

describe("Bts", () => {
  it("credits the shooter and counts frames and clips apart", () => {
    render(<BtsCredit bts={bts} />);
    expect(screen.getByRole("link", { name: "@someone" }).getAttribute("href")).toBe("https://instagram.com/someone");
    expect(screen.getByText("02 frames · 01 clip")).toBeTruthy();
  });

  it("leaves the credit out when nobody is named", () => {
    render(<BtsCredit bts={{ by: null, frames: bts.frames.slice(0, 1) }} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("01 frame")).toBeTruthy();
  });

  it("page grid names each tile", () => {
    render(<BtsPageGrid bts={bts} name="Nyx" />);
    expect(screen.getByAltText("Nyx, behind the scenes, frame 1")).toBeTruthy();
    expect(screen.getByAltText("Set light")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play Nyx, behind the scenes, clip 3" })).toBeTruthy();
  });

  it("strip grid stands a vertical clip over both rows", () => {
    const { container } = render(<BtsStripGrid bts={bts} name="Nyx" />);
    expect(container.querySelectorAll(".sm\\:row-span-2")).toHaveLength(1);
  });
});
