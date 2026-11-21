import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import { Timeline } from "@/components/proofs/timeline";
import { useClock } from "@/components/proofs/use-clock";

/* `components/proofs/timeline.tsx` and `use-clock.ts`: where a gallery
   stands on the desk, from Sent to Downloaded, and when it closes. */

const NOW = Date.parse("2026-11-20T20:00:30Z");
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const base = { email: "a@b.co", selects: [] as string[], included: 10 };
const items = () => screen.getAllByRole("listitem");

describe("useClock", () => {
  it("reads the time to the minute in the browser", () => {
    const { result } = renderHook(() => useClock());
    expect(result.current).toBe(Date.parse("2026-11-20T20:00:00Z"));
  });
});

describe("Timeline", () => {
  it("a sent gallery is done at Sent and waits on Opened", () => {
    render(<Timeline p={{ ...base, sentAt: "2026-11-18T20:00:00Z" }} />);
    const [sent, opened, selects] = items();
    expect(sent.className).toMatch(/done/);
    expect(sent.textContent).toBe("SentNov 18");
    expect(opened.className).toMatch(/now/);
    expect(opened.textContent).toBe("Openednext");
    expect(selects.className).not.toMatch(/done|now/);
    expect(items()[6].textContent).toBe("Closesonce sent");
  });

  it("the picks so far show on Selects in while the client is choosing", () => {
    render(<Timeline p={{ ...base, sentAt: "2026-11-18T20:00:00Z", firstViewAt: "2026-11-19T20:00:00Z", selects: ["a", "b", "c"] }} />);
    expect(items()[2].textContent).toBe("Selects in3 of 10 picked");
  });

  it("a later stamp marks the skipped stages done", () => {
    render(<Timeline p={{ ...base, deliveredAt: "2026-11-19T20:00:00Z" }} />);
    const [sent, , , editing, finals, downloaded] = items();
    expect(sent.textContent).toBe("Sentdone");
    expect(editing.className).toMatch(/done/);
    expect(finals.textContent).toBe("Finals sentNov 19");
    expect(downloaded.className).toMatch(/now/);
  });

  it("the last days count down and the remind window shows", () => {
    render(<Timeline p={{ ...base, sentAt: "2026-11-18T20:00:00Z", closesAt: "2026-11-22T20:00:00Z" }} />);
    const close = items()[6];
    expect(close.className).toMatch(/soon/);
    expect(close.textContent).toBe("Remind windowCloses Nov 222 days left");
  });

  it("a far close date shows no count, and no window once selects are in", () => {
    render(<Timeline p={{ ...base, sentAt: "2026-11-18T20:00:00Z", submittedAt: "2026-11-19T20:00:00Z", closesAt: "2026-12-20T20:00:00Z" }} />);
    const close = items()[6];
    expect(close.className).not.toMatch(/soon/);
    expect(close.textContent).toBe("Closes Dec 20");
  });
});
