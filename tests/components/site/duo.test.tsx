import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Duo, Mark, Marks, ThemeText } from "@/components/site/duo";

describe("duo", () => {
  it("Duo renders a dark and a light frame", () => {
    const { container } = render(<Duo dark="/work/a/01.jpg" light="/work/b/01.jpg" alt="Dark" altL="Light" sizes="50vw" />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0].className).toBe("v3d");
    expect(imgs[1].getAttribute("alt")).toBe("Light");
  });

  it("ThemeText collapses when both words match", () => {
    const { container } = render(<ThemeText dark="Same" light="Same" />);
    expect(container.innerHTML).toBe("Same");
    render(<ThemeText dark="Night" light="Day" />);
    expect(screen.getByText("Day").className).toBe("v3l");
  });

  it("Marks links strip marks and hides them when asked", () => {
    const { container } = render(<Marks />);
    expect(container.querySelector('a[href="https://www.empi.re/"]')).toBeTruthy();
    expect(container.querySelector('a[href="/portfolio/sols"]')).toBeTruthy();
    const hidden = render(<Marks hidden />);
    expect(hidden.container.querySelector('a[aria-hidden="true"]')).toBeTruthy();
  });

  it("Mark renders a named mark and nothing for an unknown slug", () => {
    render(<Mark slug="sols" name="Sols" h={20} />);
    expect(screen.getByRole("img", { name: "Sols" })).toBeTruthy();
    const { container } = render(<Mark slug="nope" name="Nope" h={20} />);
    expect(container.innerHTML).toBe("");
  });
});
