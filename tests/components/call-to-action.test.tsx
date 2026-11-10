import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CallToAction } from "@/components/call-to-action";

describe("CallToAction", () => {
  it("links to the form with the type and the project", () => {
    render(
      <CallToAction title="Like this?" body="Write in." type="editorial" detail="Nyx & co" secondary={{ href: "/book", label: "Book a session" }} />,
    );
    expect(screen.getByRole("region", { name: "Like this?" })).toBeTruthy();
    expect(screen.getByText("Write in.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Inquire" }).getAttribute("href")).toBe("/?type=editorial&ref=Nyx%20%26%20co#contact");
    expect(screen.getByRole("link", { name: "Book a session" }).getAttribute("href")).toBe("/book");
  });

  it("defaults to other with no detail", () => {
    render(<CallToAction title="Ask" />);
    expect(screen.getByRole("link", { name: "Inquire" }).getAttribute("href")).toBe("/?type=other#contact");
  });
});
