import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminInbox, References, unreadCount } from "@/components/admin/admin-inbox";
import { KEY_STORE, TOKEN_STORE } from "@/lib/admin-github";
import type { Enquiry } from "@/lib/inbox";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const rows = [
  { key: "m1", id: "1", at: new Date().toISOString(), type: "portraits", name: "Ana", email: "a@x.com", read: false },
  { key: "m2", id: "2", at: new Date().toISOString(), type: "booking", name: "Bo", email: "b@x.com", read: true, detail: "Portraits" },
];
const answer = (body: unknown, ok = true) => {
  const f = vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 401 }));
  vi.stubGlobal("fetch", f);
  return f;
};

describe("unreadCount", () => {
  it("is null without credentials", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await unreadCount()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("counts unread rows", async () => {
    window.localStorage.setItem(TOKEN_STORE, "tok");
    answer({ rows });
    expect(await unreadCount()).toBe(1);
  });
});

describe("AdminInbox", () => {
  it("shows the unlock form when nothing is saved", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<AdminInbox />);
    expect(screen.getByRole("heading", { name: /Inquiries/ })).toBeTruthy();
    expect(screen.getByPlaceholderText("INBOX_KEY")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open the inbox" })).toBeTruthy();
  });

  it("unlocks with a pasted key and lists rows", async () => {
    answer({ rows });
    const onUnread = vi.fn();
    render(<AdminInbox onUnread={onUnread} />);
    fireEvent.change(screen.getByPlaceholderText("INBOX_KEY"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Open the inbox" }));
    expect(await screen.findByText("Ana")).toBeTruthy();
    expect(screen.getByText(/2 total · 1 unread/)).toBeTruthy();
    expect(window.localStorage.getItem(KEY_STORE)).toBe("secret");
    await waitFor(() => expect(onUnread).toHaveBeenCalledWith(1));
  });

  it("shows the server error", async () => {
    window.localStorage.setItem(TOKEN_STORE, "tok");
    answer({ error: "Not authorized" }, false);
    render(<AdminInbox />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });
});

describe("References", () => {
  it("renders nothing with no files or picks", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { container } = render(<References msgKey="m1" enquiry={{} as Enquiry} auth={{}} />);
    expect(container.innerHTML).toBe("");
  });

  it("links his own picked frames", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<References msgKey="m1" enquiry={{ picks: ["/work/x/01.jpg"] } as unknown as Enquiry} auth={{}} />);
    expect(screen.getByText("Picked from my work")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/work/x/01.jpg");
  });
});
