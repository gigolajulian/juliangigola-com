import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContractSign } from "@/components/contracts/sign";
import type { PublicContract } from "@/lib/contracts/contract";

afterEach(() => vi.unstubAllGlobals());

const initial: PublicContract = {
  to: { name: "Ana Reyes", email: "", address: "" },
  from: ["Julian Gigola"],
  text: "The terms.",
  hash: "abc123",
  signed: null,
};
const signed = { name: "Ana Reyes", at: "2026-11-20T20:00:00.000Z", hash: "abc123", mark: null };

function setup() {
  const fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ signed }), { status: 200 })));
  vi.stubGlobal("fetch", fetch);
  render(<ContractSign id="c1" initial={initial} />);
  const sign = screen.getByRole("button", { name: "Sign" });
  return { fetch, sign, off: () => sign.hasAttribute("data-off") };
}
const fill = (name: string, email: string) => {
  fireEvent.change(screen.getByPlaceholderText("First and last name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Your email"), { target: { value: email } });
};
const agree = () => fireEvent.click(screen.getByRole("checkbox", { name: "I agree to this contract." }));
const typedName = () => fireEvent.click(screen.getByRole("button", { name: "Can't draw? Use your typed name" }));

describe("ContractSign", () => {
  it("stays off until a full name, a signature, an email and I agree, and posts nothing before", () => {
    const { fetch, sign, off } = setup();
    fill("Ana", "ana@x.com");
    typedName();
    agree();
    expect(off(), "one name").toBe(true);
    fill("Ana Reyes", "ana@");
    expect(off(), "bad email").toBe(true);
    fireEvent.click(sign);
    expect(screen.getByRole("alert").textContent).toBe("That email does not look right.");
    fill("Ana Reyes", "ana@x.com");
    agree();
    expect(off(), "agree unticked").toBe(true);
    agree();
    expect(off()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("signs with the typed name: posts name, email, agree, hash and typed, then shows the record", async () => {
    const { fetch, sign } = setup();
    fill(" Ana Reyes ", "ana@x.com ");
    typedName();
    agree();
    fireEvent.click(sign);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Signed by Ana Reyes"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Signed.");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/contract/c1");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Ana Reyes", email: "ana@x.com", agree: true, hash: "abc123", typed: true });
  });

  it("signs with a drawn mark: the pad's path goes up as mark", async () => {
    const { fetch, sign, off } = setup();
    fill("Ana Reyes", "ana@x.com");
    agree();
    expect(off(), "no mark yet").toBe(true);
    const pad = screen.getByRole("img", { name: /Signature box/ });
    pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 200 }) as DOMRect;
    pad.setPointerCapture = () => {};
    fireEvent.pointerDown(pad, { clientX: 100, clientY: 50, button: 0 });
    // a script's event has no coalesced events; a real move lists itself, as here
    const move = new PointerEvent("pointermove", { bubbles: true, clientX: 200, clientY: 100 });
    Object.defineProperty(move, "getCoalescedEvents", { value: () => [move] });
    fireEvent(pad, move);
    fireEvent.pointerUp(pad);
    expect(off()).toBe(false);
    fireEvent.click(sign);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Signed by Ana Reyes"));
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Ana Reyes",
      email: "ana@x.com",
      agree: true,
      hash: "abc123",
      mark: "M100 50 L200 100",
    });
  });
});
