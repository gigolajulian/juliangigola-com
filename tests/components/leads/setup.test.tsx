import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SignIn } from "@/components/desk/sign-in";
import { swScope } from "@/components/leads/setup";

describe("SignIn", () => {
  it("hands up the trimmed key, never an empty one", () => {
    const onKey = vi.fn();
    render(<SignIn onKey={onKey} wrong={false} />);
    const box = screen.getByLabelText("Inbox key or GitHub token");
    fireEvent.change(box, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Open leads" }));
    expect(onKey).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "  ghp_test  " } });
    fireEvent.click(screen.getByRole("button", { name: "Open leads" }));
    expect(onKey).toHaveBeenCalledWith("ghp_test");
    expect(screen.queryByText(/not accepted/)).toBeNull();
  });

  it("says when the key was refused, and scopes the worker to the desk", () => {
    render(<SignIn onKey={() => {}} wrong />);
    expect(screen.getByText("That was not accepted. Paste it again.")).toBeTruthy();
    expect(swScope()).toBe("/admin/leads");
  });
});
