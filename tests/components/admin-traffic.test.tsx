import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminTraffic } from "@/components/admin/admin-traffic";
import { TOKEN_STORE } from "@/lib/admin/admin-github";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("AdminTraffic", () => {
  it("asks for a token when signed out", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<AdminTraffic />);
    expect(screen.getByRole("heading", { name: /Traffic/ })).toBeTruthy();
    expect(await screen.findByText("Sign in with the GitHub token first.")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the visit counts from /api/traffic", async () => {
    window.localStorage.setItem(TOKEN_STORE, "tok");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ visits: 42, sources: [{ key: "google", n: 10 }], devices: [{ key: "mobile", n: 21 }] }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminTraffic />);
    expect(await screen.findByText("42")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect((fetchMock.mock.calls as unknown[][])[0][0]).toBe("/api/traffic");
    expect(screen.getByRole("link", { name: "Search Console" }).getAttribute("target")).toBe("_blank");
  });
});
