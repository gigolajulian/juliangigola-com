import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Intro } from "@/components/splash/intro";

describe("Intro", () => {
  it("renders the hidden layer with its inline script", () => {
    const { container } = render(<Intro run={["/work/nyx/cover.jpg"]} />);
    const layer = container.querySelector("#jg-intro")!;
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("style")?.textContent).toBe("#jg-intro{display:none}");
    expect(layer.querySelector(".jg-sheet-ground")).toBeTruthy();
    // Scripts set through innerHTML never run, so the opening itself does not play in jsdom.
    expect(layer.querySelector("script")?.textContent).toContain("jg-intro");
  });

  it("its inline script stands alone: no imported helper is referenced once stringified", () => {
    const { container } = render(<Intro run={["/work/nyx/cover.jpg"]} />);
    document.documentElement.dataset.intro = "1";
    sessionStorage.removeItem("jg-intro");
    const code = container.querySelector("#jg-intro script")!.textContent!;
    try {
      new Function(code)();
    } catch (e) {
      expect(e).not.toBeInstanceOf(ReferenceError);
    } finally {
      delete document.documentElement.dataset.intro;
    }
    expect(sessionStorage.getItem("jg-intro")).toBe("1");
  });
});
