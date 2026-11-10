import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { PendingLabel } from "@/components/pending-label";

describe("PendingLabel", () => {
  it("shows its words when nothing is pending", () => {
    render(
      <Link href="/book">
        <PendingLabel state="connecting">Book a session</PendingLabel>
      </Link>,
    );
    expect(screen.getByText("Book a session").className).toBe("");
  });
});
