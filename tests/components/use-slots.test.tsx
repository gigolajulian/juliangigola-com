import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSlots } from "@/components/booking/use-slots";
import { recent } from "@/components/booking/time-picker-parts";

/* The picker's times (`components/booking/use-slots.ts`): ready with the event's
   details, or the fallback when the times do not come. */

const answer = { status: "success", event: { lengthInMinutes: 45, title: "Call", locations: [{ type: "attendeeDefined" }] }, data: { "2026-12-01": [{ start: "2026-12-01T18:00:00Z" }] } };

afterEach(() => {
  vi.unstubAllGlobals();
  recent.clear();
});

describe("useSlots", () => {
  it("loads the times and the event they belong to", async () => {
    const fetch = vi.fn(async (_url: string) => Response.json(answer));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useSlots("julian", "intro-call", "America/Los_Angeles"));
    expect(result.current.state).toBe("loading");
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current).toMatchObject({ length: 45, session: "Call", needsWhere: true, paid: false, days: answer.data });
    expect(String(fetch.mock.calls[0][0])).toMatch(/^\/api\/slots\?slug=intro-call&start=.+&timeZone=America%2FLos_Angeles$/);
  });

  it("falls back when the times do not come, and forgets the cached answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "error" })));
    const { result } = renderHook(() => useSlots("julian", "intro-call", "UTC"));
    await waitFor(() => expect(result.current.state).toBe("fallback"));
    expect(recent.size).toBe(0);
  });

  it("falls back for a paid session on a build without Stripe's key", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PK", "");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(answer)));
    const { result } = renderHook(() => useSlots("julian", "portraits", "UTC"));
    await waitFor(() => expect(result.current.state).toBe("fallback"));
    vi.unstubAllEnvs();
  });
});
