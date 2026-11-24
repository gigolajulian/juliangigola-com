import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";

// J and G let go of the picker as soon as the times are in.
vi.mock("@/components/splash/jg-load", () => ({
  JgLoad: ({ done, onDone }: { done: boolean; onDone: () => void }) => {
    React.useEffect(() => void (done && onDone()), [done, onDone]);
    return null;
  },
}));
// Stripe never loads in jsdom: the deposit step shows what it was handed.
vi.mock("@/components/booking/deposit-step", async (orig) => ({
  ...(await orig<typeof import("@/components/booking/deposit-step")>()),
  DepositStep: ({ body, rows, head }: { body: object; rows: [string, string][]; head?: React.ReactNode }) => (
    <div data-testid="deposit" data-body={JSON.stringify(body)}>
      {head}
      {rows.map(([k, v]) => <p key={k}>{`${k}: ${v}`}</p>)}
    </div>
  ),
}));
vi.mock("@/components/reference-picks", () => ({ ReferencePicks: () => null }));

import { usePicker, type CardCtx, type Props } from "@/components/booking/use-picker";
import { EditorialCard } from "@/components/booking/time-picker-editorial";
import { BookSteps, useStepsLayout } from "@/components/booking/time-picker-steps";
import { JgLoad } from "@/components/splash/jg-load";
import { clock, DAYS, fromIso, MONTHS, recent, type StepsSkin } from "@/components/booking/time-picker-parts";

const slots = {
  "2026-11-19": ["10:00", "11:00", "12:00"],
  "2026-11-20": [],
  "2026-11-23": ["14:00"],
};
const answer = (length = 60) => ({
  title: "Session",
  length,
  where: false,
  slots: Object.fromEntries(Object.entries(slots).map(([d, ts]) => [d, ts.map((t) => `${d}T${t}:00-08:00`)])),
});

type Call = [string, RequestInit | undefined];
const calls = () => (fetch as unknown as { mock: { calls: Call[] } }).mock.calls;
function stubFetch(book: () => Response = () => Response.json({ id: "b1" })) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.startsWith("/api/slots") ? Response.json(answer()) : book())));
}

/* The same wiring as TimePicker: the hook, then the card for the time on show. */
function Card(props: Props) {
  const c = usePicker(props);
  const steps = useStepsLayout(c);
  if (c.state === "fallback") return <>{props.fallback}</>;
  if (!c.days || !c.pick || c.held) return <p role="status">Loading<JgLoad done={c.state === "ready" && !!c.days} onDone={c.unhold} /></p>;
  const [t, ap] = clock(c.pick.min);
  const [until] = clock(c.pick.min + c.length);
  const date = fromIso(c.pick.date);
  const sum = `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} · ${t} ${ap}`;
  const ctx: CardCtx = { ...c, pick: c.pick, days: c.days, t, ap, until, date, sum };
  return props.skin ? <BookSteps c={{ ...ctx, skin: props.skin }} l={steps} /> : <EditorialCard c={ctx} />;
}

const skin: StepsSkin = {
  name: "Call",
  from: null,
  shell: ({ head, ok, body, bar }) => (
    <section>
      <h1>{head}</h1>
      {ok ? <p>{ok}</p> : null}
      {body}
      <footer>{bar}</footer>
    </section>
  ),
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 18, 12)); // Wed 18 Nov 2026, noon
  recent.clear();
  // Reduced motion: the steps land at once instead of sliding in hidden (GSAP).
  const mm = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((q) => ({ ...mm(q), matches: q.includes("prefers-reduced-motion") }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const day = (name: string) => screen.getByRole("button", { name });

describe("usePicker", () => {
  it("falls back when the times cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "error" })));
    const { result } = renderHook(() => usePicker({ path: "julian/call", title: "Pick", fallback: null }));
    await waitFor(() => expect(result.current.state).toBe("fallback"));
  });

  it("falls back on a paid session when the build has no Stripe key", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PK", "");
    stubFetch();
    const { result } = renderHook(() => usePicker({ path: "julian/portraits", title: "Pick", fallback: null }));
    await waitFor(() => expect(result.current.state).toBe("fallback"));
  });

  it("opens on the first open time and keeps a picked time only where the day has it", async () => {
    stubFetch();
    const { result } = renderHook(() => usePicker({ path: "julian/call", title: "Pick", fallback: null }));
    await waitFor(() => expect(result.current.pick).toEqual({ date: "2026-11-19", min: 600, start: "2026-11-19T10:00:00-08:00" }));
    expect(result.current.chosen).toBe(false);
    expect(calls()[0][0]).toMatch(/^\/api\/slots\?slug=call&start=2026-11-18&end=/);

    act(() => result.current.choose("2026-11-19", 660, true));
    expect(result.current.pick?.min).toBe(660);
    expect(result.current.chosen).toBe("time");

    // A day without 11:00 takes its first time, and the time is to pick again.
    act(() => result.current.choose("2026-11-23", 660, false));
    expect(result.current.pick).toMatchObject({ date: "2026-11-23", min: 840 });
    expect(result.current.chosen).toBe("day");

    // A closed day is not a pick.
    act(() => result.current.choose("2026-11-20", 600, false));
    expect(result.current.pick?.date).toBe("2026-11-23");
  });
});

describe("EditorialCard", () => {
  it("shows the default pick with Continue held until a time is picked", async () => {
    stubFetch();
    render(<Card path="julian/call" title="Pick a time" fallback={null} />);
    await screen.findByRole("region", { name: "Pick a time" });
    expect(screen.getByText("Pick a day, then a time")).toBeTruthy();
    expect(day("Thursday, November 19").getAttribute("aria-pressed")).toBe("true");
    expect((day("Friday, November 20") as HTMLButtonElement).disabled).toBe(true);
    expect((day("Earlier") as HTMLButtonElement).disabled).toBe(true);
    expect((day("Continue") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(day("Monday, November 23"));
    expect(day("Monday, November 23").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("button", { name: /^\d+:\d\d [AP]M$/ }).map((b) => b.textContent)).toEqual(["2:00 PM"]);
    expect((day("Continue") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(day("2:00 PM"));
    expect(day("2:00 PM").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Then your details")).toBeTruthy();
    expect((day("Continue") as HTMLButtonElement).disabled).toBe(false);
  });

  it("opens the details after Continue and says when the time was taken", async () => {
    stubFetch(() => Response.json({ error: "That time was just taken. Pick another.", code: "taken" }, { status: 409 }));
    render(<Card path="julian/call" title="Pick a time" fallback={null} />);
    fireEvent.click(await screen.findByRole("button", { name: "11:00 AM" }));
    fireEvent.click(day("Continue"));
    const email = await screen.findByRole("textbox", { name: "Email" }, { timeout: 3000 });
    fireEvent.change(screen.getByRole("textbox", { name: "First name" }), { target: { value: "Ana" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Last name" }), { target: { value: "Lee" } });
    fireEvent.change(email, { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone" }), { target: { value: "(408) 555 0134" } });
    fireEvent.click(screen.getByRole("button", { name: "Book it" }));

    expect((await screen.findByRole("alert")).textContent).toBe("That time was just taken. Pick another.");
    const [url, init] = calls().find(([u]) => u === "/api/book")!;
    expect(url).toBe("/api/book");
    expect(JSON.parse(String(init?.body))).toMatchObject({ slug: "call", name: "Ana Lee", email: "ana@example.com", phone: "+14085550134", via: "Video", start: "2026-11-19T19:00:00.000Z" });
    // The times are asked for again, fresh.
    await waitFor(() => expect(calls().some(([u]) => u.startsWith("/api/slots") && u.endsWith("&fresh"))).toBe(true));
  });

  it("takes a paid session to its deposit instead of booking", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PK", "pk_test_123");
    stubFetch();
    render(<Card path="julian/portraits" title="Pick a time" fallback={null} />);
    fireEvent.click(await screen.findByRole("button", { name: "10:00 AM" }));
    fireEvent.click(day("Continue"));
    const email = await screen.findByRole("textbox", { name: "Email" }, { timeout: 3000 });
    expect(screen.getByText("Next: $250 deposit")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "First name" }), { target: { value: "Ana" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Last name" }), { target: { value: "Lee" } });
    fireEvent.change(email, { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone" }), { target: { value: "4085550134" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const step = await screen.findByTestId("deposit");
    expect(JSON.parse(step.dataset.body!)).toMatchObject({ slug: "portraits", name: "Ana Lee", email: "ana@example.com", phone: "+14085550134", start: "2026-11-19T18:00:00.000Z" });
    expect(screen.getByText("$250")).toBeTruthy();
    expect(screen.getByText("Session: Session, 60 min")).toBeTruthy();
    expect(calls().some(([u]) => u === "/api/book")).toBe(false);
  });
});

describe("BookSteps", () => {
  it("steps the time with the arrows and keys, within the day's open times", async () => {
    stubFetch();
    render(<Card path="julian/call" title="Pick a time" fallback={null} skin={skin} />);
    const time = await screen.findByRole("spinbutton", { name: "Time" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Book a call");
    expect(time.getAttribute("aria-valuetext")).toBe("10:00 AM");
    expect((day("Earlier time") as HTMLButtonElement).disabled).toBe(true);
    expect((day("Fri, Nov 20") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(day("Later time"));
    expect(time.getAttribute("aria-valuetext")).toBe("11:00 AM");
    fireEvent.keyDown(time, { key: "ArrowRight" });
    expect(time.getAttribute("aria-valuetext")).toBe("12:00 PM");
    expect((day("Later time") as HTMLButtonElement).disabled).toBe(true);
    expect(day("12:00 PM").getAttribute("aria-pressed")).toBe("true");
  });

  it("checks the details, then books the call", async () => {
    stubFetch();
    render(<Card path="julian/call" title="Pick a time" fallback={null} skin={skin} />);
    fireEvent.click(await screen.findByRole("button", { name: "11:00 AM" }));
    fireEvent.click(day("Continue"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("About you");

    fireEvent.click(day("Book the call"));
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual(["Add your name", "Email looks incomplete"]);
    expect(calls().some(([u]) => u === "/api/book")).toBe(false);

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Ana Lee" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "ana@example.com" } });
    fireEvent.click(day("Book the call"));

    await screen.findByRole("heading", { name: "Ana, you're in." });
    await screen.findByText("Booked");
    const [, init] = calls().find(([u]) => u === "/api/book")!;
    // The phone is optional on V3.
    expect(JSON.parse(String(init?.body))).toMatchObject({ slug: "call", name: "Ana Lee", phone: "", start: "2026-11-19T19:00:00.000Z" });
  });
});
