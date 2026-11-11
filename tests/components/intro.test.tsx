import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Intro } from "@/components/splash/intro";

describe("Intro", () => {
  it("renders the hidden layer with its inline script", () => {
    const { container } = render(<Intro run={["/work/nyx/cover.jpg"]} />);
    const layer = container.querySelector("#jg-intro")!;
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("style")?.textContent).toBe("#jg-intro{display:none}");
    expect(layer.querySelector(".jg-sheet-plane")).toBeTruthy();
    // Scripts set through innerHTML never run, so the opening itself does not play in jsdom.
    expect(layer.querySelector("script")?.textContent).toContain("jg-intro");
  });
});
