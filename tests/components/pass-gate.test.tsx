import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PassGate } from "@/components/proofs/pass-gate";

afterEach(() => vi.unstubAllGlobals());

const gate = (status: number, body: object) => {
  const fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal("fetch", fetch);
  render(<PassGate id="g1" kind="proofs" />);
  return { fetch, open: screen.getByRole("button", { name: "Open proofs" }) };
};
const type = (v: string) => fireEvent.change(screen.getByLabelText("Password"), { target: { value: v } });

describe("PassGate", () => {
  it("stays off with no password and posts nothing", () => {
    const { fetch, open } = gate(200, { ok: true });
    expect(open.hasAttribute("data-off")).toBe(true);
    fireEvent.click(open);
    expect(screen.getByRole("alert").textContent).toBe("Add the password.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts unlock with the password and, on a 200, stays busy while the page reloads into the gallery", async () => {
    const { fetch, open } = gate(200, { ok: true });
    type("hunter 2");
    expect(open.hasAttribute("data-off")).toBe(false);
    fireEvent.click(open);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/proof/g1");
    expect(JSON.parse(String(init.body))).toEqual({ action: "unlock", password: "hunter 2" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Checking" })).toHaveProperty("disabled", true));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the server's error on a wrong password and lets them try again", async () => {
    const { open } = gate(401, { error: "That password is not right." });
    type("nope");
    fireEvent.click(open);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("That password is not right."));
    expect(screen.getByRole("button", { name: "Open proofs" })).toHaveProperty("disabled", false);
  });
});
