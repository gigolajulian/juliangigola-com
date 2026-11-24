import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminSeo } from "@/components/admin/admin-seo";
import { TOKEN_STORE } from "@/lib/admin/admin-github";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("AdminSeo", () => {
  it("asks for a token when signed out", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<AdminSeo />);
    expect(screen.getByRole("heading", { name: /SEO/ })).toBeTruthy();
    expect(await screen.findByText("Sign in with the inbox key or the GitHub token first.")).toBeTruthy();
  });

  it("pulls the range and switches it", async () => {
    window.localStorage.setItem(TOKEN_STORE, "tok");
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ visits: 7, google: { error: "not linked" } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminSeo />);
    expect(await screen.findByText("Google: not linked")).toBeTruthy();
    expect((fetchMock.mock.calls as unknown[][])[0][0]).toBe("/api/seo?days=28");
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    await waitFor(() => expect((fetchMock.mock.calls as unknown[][]).some((c) => c[0] === "/api/seo?days=7")).toBe(true));
    expect(screen.getByRole("button", { name: "7d" }).getAttribute("aria-pressed")).toBe("true");
  });
});
