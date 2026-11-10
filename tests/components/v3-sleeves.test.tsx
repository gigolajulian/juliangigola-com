import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CoverArt } from "@/components/v3/sleeves";
import { COVER_RELEASES } from "@/lib/cover-art-data";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};

afterEach(() => document.documentElement.removeAttribute("data-sleeve"));

describe("CoverArt", () => {
  it("shows the old rack without the sleeve flag", () => {
    const { container } = render(<CoverArt releases={COVER_RELEASES} />);
    expect(container.querySelector(".slv")).toBeNull();
    expect(container.firstChild).toBeTruthy();
  });

  it("shows sleeves with the flag and opens the viewer on a click", () => {
    document.documentElement.setAttribute("data-sleeve", "");
    render(<CoverArt releases={COVER_RELEASES} />);
    const r = COVER_RELEASES[0];
    fireEvent.click(screen.getByRole("button", { name: `Open ${r.title} by ${r.artist}` }));
    expect(screen.getByRole("button", { name: "Turn to side B" })).toBeTruthy();
  });
});
