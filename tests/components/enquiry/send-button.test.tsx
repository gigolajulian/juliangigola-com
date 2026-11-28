import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("@/components/enquiry/submit", () => ({ INITIAL: { status: "idle" }, submitOrKeep: vi.fn() }));
vi.mock("@/components/analytics/visit-trail", () => ({ trailContext: () => "" }));

import { SendButton } from "@/components/enquiry/flow";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.ds;
});

describe("SendButton", () => {
  it("is the plain submit button without the flag", () => {
    const { container } = render(
      <SendButton st={0} pending={false}>
        Send note
      </SendButton>,
    );
    expect(container.innerHTML).toBe('<button type="submit" class="btn fill">Send note</button>');
  });

  it("ds: one label is read at a time, and it cannot be pressed while sending or sent", () => {
    document.documentElement.dataset.ds = "";
    for (const [st, label] of [
      [0, "Send note"],
      [1, "Sending"],
      [2, "Sent"],
    ] as const) {
      const { container } = render(
        <SendButton st={st} pending={false}>
          Send note
        </SendButton>,
      );
      const b = container.querySelector("button")!;
      expect(b.dataset.st).toBe(String(st));
      expect(b.disabled).toBe(st > 0);
      expect([...b.querySelectorAll(".ds-sb-ll > span:not([aria-hidden=true])")].map((s) => s.textContent)).toEqual([label]);
      cleanup();
    }
  });
});
