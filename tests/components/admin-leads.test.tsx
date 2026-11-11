import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminLeads, SignIn } from "@/components/admin/admin-leads";
import { money, OFFLINE } from "@/lib/lead-desk";
import { KEY_STORE } from "@/lib/admin/admin-github";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const answer = (body: unknown, status = 200) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );

describe("lead helpers", () => {
  it("money rounds to whole dollars", () => {
    expect(money(1234.6)).toBe("$1,235");
  });

  it("OFFLINE is a plain sentence", () => {
    expect(OFFLINE).toMatch(/^Offline\./);
  });
});

describe("SignIn", () => {
  it("submits a trimmed key", () => {
    const onKey = vi.fn();
    render(<SignIn onKey={onKey} wrong={false} />);
    fireEvent.change(screen.getByLabelText("Inbox key or GitHub token"), { target: { value: "  k1  " } });
    fireEvent.click(screen.getByRole("button", { name: "Open leads" }));
    expect(onKey).toHaveBeenCalledWith("k1");
  });

  it("says when the last key was refused", () => {
    render(<SignIn onKey={() => {}} wrong />);
    expect(screen.getByText(/not accepted/)).toBeTruthy();
  });
});

describe("AdminLeads", () => {
  it("shows loading, then a server error", async () => {
    answer({ error: "Something broke" }, 500);
    render(<AdminLeads />);
    expect(screen.getByText("Loading leads")).toBeTruthy();
    expect(await screen.findByText("Something broke")).toBeTruthy();
  });

  it("renders the desk with no leads", async () => {
    answer({ leads: [] });
    render(<AdminLeads />);
    expect((await screen.findAllByText("Leads")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading leads")).toBeNull();
  });

  it("falls back to sign in when not authorized", async () => {
    answer({ error: "Not authorized." }, 401);
    render(<AdminLeads />);
    expect(await screen.findByRole("button", { name: "Open leads" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Inbox key or GitHub token"), { target: { value: "inbox-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Open leads" }));
    expect(window.localStorage.getItem(KEY_STORE)).toBe("inbox-key");
  });
});
