import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AboutGallery } from "@/components/v3/about-gallery";

describe("AboutGallery", () => {
  it("shows the first caption and steps on a tick", () => {
    render(<AboutGallery />);
    expect(screen.getByText("Julian Gigola, San Jose")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Photo 2" }));
    expect(screen.getByText("Julian Gigola, on set")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Photo 2" }).className).toBe("on");
  });
});
