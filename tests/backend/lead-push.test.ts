import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKV } from "./fakes";
import { notify, pushFor, subscribe, unsubscribe } from "@/lib/leads/lead-push";

/* The lead desk's pushes: one row per device, only arrivals ping, a
   device the push service calls gone is forgotten, and nothing throws. */

const sent = vi.hoisted(() => ({ gone: new Set<string>(), calls: [] as string[] }));
vi.mock("@/lib/leads/web-push", () => ({
  send: async (_secret: string, sub: { endpoint: string }) => {
    sent.calls.push(sub.endpoint);
    return sent.gone.has(sub.endpoint) ? "gone" : "ok";
  },
}));

const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: "p", auth: "a" } });
const push = { title: "New inquiry", body: "Ana", url: "/admin/leads" };

beforeEach(() => {
  sent.gone.clear();
  sent.calls = [];
});

describe("subscribe", () => {
  it("keeps one row per endpoint, under a hash, and forgets it on unsubscribe", async () => {
    const kv = new FakeKV();
    await subscribe(kv as never, sub("https://push.example/1"));
    await subscribe(kv as never, sub("https://push.example/1"));
    const keys = [...kv.data.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^push:[0-9a-f]{24}$/);
    expect(keys[0]).not.toContain("example");
    await unsubscribe(kv as never, "https://push.example/1");
    expect(kv.data.size).toBe(0);
  });
});

describe("pushFor", () => {
  it("pings arrivals with the lead's name and kind, nothing else", () => {
    expect(pushFor({ name: "Ana", kind: "portraits" } as never, { kind: "inquiry" } as never)).toEqual({ title: "New inquiry", body: "Ana, portraits", url: "/admin/leads" });
    expect(pushFor({ name: "Ana" } as never, { kind: "booking" } as never)?.body).toBe("Ana");
    expect(pushFor({ name: "Ana" } as never, { kind: "note" } as never)).toBeNull();
  });
});

describe("notify", () => {
  it("sends nothing without the secret", async () => {
    const kv = new FakeKV();
    await subscribe(kv as never, sub("https://push.example/1"));
    await notify(kv as never, undefined, push);
    expect(sent.calls).toEqual([]);
  });
  it("pings every device and forgets the gone ones", async () => {
    const kv = new FakeKV();
    await subscribe(kv as never, sub("https://push.example/live"));
    await subscribe(kv as never, sub("https://push.example/gone"));
    sent.gone.add("https://push.example/gone");
    await notify(kv as never, "{}", push);
    expect(sent.calls.sort()).toEqual(["https://push.example/gone", "https://push.example/live"]);
    expect(kv.data.size).toBe(1);
  });
  it("never throws when the store is down", async () => {
    const kv = new FakeKV();
    kv.broken = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notify(kv as never, "{}", push)).resolves.toBeUndefined();
  });
});
