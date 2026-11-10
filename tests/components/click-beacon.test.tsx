import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ClickBeacon } from "@/components/click-beacon";

describe("ClickBeacon", () => {
  it("sends the presses once when the page view ends", () => {
    const send = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: send, configurable: true });
    const btn = document.createElement("button");
    btn.textContent = "Book a session";
    document.body.append(btn);
    const { container, unmount } = render(<ClickBeacon />);
    expect(container.innerHTML).toBe("");
    fireEvent.pointerDown(btn, { clientX: 10, clientY: 10 });
    unmount();
    expect(send).toHaveBeenCalledTimes(1);
    const [url, body] = send.mock.calls[0] as unknown as [string, string];
    expect(url).toBe("/api/beacon");
    const beacon = JSON.parse(body);
    expect(beacon.p).toBe("/");
    expect(beacon.v).toBe(true);
    expect(beacon.c[0][2]).toBe("Book a session");
    btn.remove();
  });
});
