import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotFoundScene } from "@/components/not-found-scene";

describe("NotFoundScene", () => {
  it("fills in the path and locks focus without a fine pointer", () => {
    render(
      <NotFoundScene>
        <h1 data-numerals>404</h1>
        <p data-focus-readout>...</p>
        <p data-requested-path>...</p>
      </NotFoundScene>,
    );
    expect(screen.getByRole("heading", { name: "404" })).toBeTruthy();
    expect(screen.getByText("FOCUS LOCKED")).toBeTruthy();
    expect(document.querySelector("[data-requested-path]")?.textContent).toBe("/");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

