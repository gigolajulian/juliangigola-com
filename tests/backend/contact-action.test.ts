import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOLDOWN_MS, DAILY_CAP, dayKey } from "@/lib/inbox";
import { FakeEmail, FakeKV, reply } from "./fakes";

/* The contact form's server action (`app/contact/actions.ts`). Its one
   rule: an enquiry never disappears quietly. Stored, or a mailto handed
   back that says why; the mail copy is best effort and never turns a
   stored enquiry into an error. No real mail is sent: EMAIL is a fake. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown>, cf: {} as Record<string, unknown>, ip: "203.0.113.7" }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env, cf: ctx.cf, ctx: { waitUntil: () => {} } }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "cf-connecting-ip": ctx.ip }) }));

const { submitEnquiry } = await import("@/app/contact/actions");

const form = (fields: Record<string, string | string[] | File[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const GOOD = { type: "portrait", name: "QA Test", email: "qa@example.com", detail: "Oct, SF", message: "A portrait session." };
const send = (fields: Record<string, string | string[] | File[]> = GOOD) => submitEnquiry({ status: "idle" }, form(fields));

let kv: FakeKV, email: FakeEmail, assets: { fetch: ReturnType<typeof vi.fn> };
beforeEach(() => {
  kv = new FakeKV();
  email = new FakeEmail();
  assets = { fetch: vi.fn(async () => reply("jpegbytes", 200, { "content-type": "image/jpeg" })) };
  ctx.env = { INBOX: kv, EMAIL: email, ASSETS: assets };
  ctx.cf = { country: "US" };
  ctx.ip = `203.0.113.${Math.floor(Math.random() * 250)}`;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const msgs = () => [...kv.data.keys()].filter((k) => k.startsWith("msg:"));

describe("submitEnquiry", () => {
  it("answers the honeypot with success and stores nothing", async () => {
    const res = await send({ ...GOOD, company: "Spam LLC" });
    expect(res.status).toBe("sent");
    expect(kv.puts).toEqual([]);
    expect(email.sent).toEqual([]);
  });

  it("returns field errors and echoes the values, storing nothing", async () => {
    const res = await send({ type: "portrait", name: "", email: "not-an-email", message: "" });
    expect(res.status).toBe("error");
    expect(Object.keys(res.errors!).sort()).toEqual(["email", "message", "name"]);
    expect(res.values).toMatchObject({ email: "not-an-email" });
    expect(kv.puts).toEqual([]);
  });

  it("stores a good enquiry with its summary, cooldown and day count, then mails a copy", async () => {
    const res = await send();
    expect(res.status).toBe("sent");
    const [key] = msgs();
    expect(kv.json(key)).toMatchObject({ type: "portrait", name: "QA Test", email: "qa@example.com", detail: "Oct, SF", country: "US", read: false });
    expect(kv.data.get(key)!.metadata).toMatchObject({ name: "QA Test", read: false });
    const cool = [...kv.data.keys()].find((k) => k.startsWith("cool:"))!;
    expect(cool).toMatch(/^cool:[0-9a-f]{32}$/);
    expect(cool).not.toContain(ctx.ip);
    expect(kv.data.get(cool)!.ttl).toBe(COOLDOWN_MS / 1000);
    expect(kv.data.get(dayKey(Date.now()))!.value).toBe("1");
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({ to: "contact@juliangigola.com", replyTo: { name: "QA Test", email: "qa@example.com" } });
  });

  it("keeps a header out of the name: no newline reaches the stored copy", async () => {
    await send({ ...GOOD, name: "QA\r\nBcc: victim@example.com" });
    expect(kv.json(msgs()[0]).name).toBe("QA Bcc: victim@example.com");
  });

  it("holds a second enquiry from the same sender inside five minutes, with a mailto", async () => {
    expect((await send()).status).toBe("sent");
    const again = await send();
    expect(again.status).toBe("error");
    expect(again.message).toMatch(/write again in 5 minutes/);
    expect(again.mailto).toMatch(/^mailto:contact@juliangigola\.com\?subject=/);
    expect(msgs()).toHaveLength(1);
  });

  it("stops at the daily cap and hands back the mailto", async () => {
    await kv.put(dayKey(Date.now()), String(DAILY_CAP));
    const res = await send();
    expect(res.status).toBe("unconfigured");
    expect(res.mailto).toBeTruthy();
    expect(msgs()).toEqual([]);
  });

  it("says so plainly when the build has no inbox, with the message ready to send", async () => {
    ctx.env = {};
    const res = await send();
    expect(res.status).toBe("unconfigured");
    expect(decodeURIComponent(res.mailto!)).toContain("A portrait session.");
  });

  it("hands back the mailto when the store fails, never a false success", async () => {
    kv.broken = true;
    const res = await send();
    expect(res.status).toBe("unconfigured");
    expect(res.mailto).toBeTruthy();
  });

  it("still says sent when only the mail copy fails: the stored copy is the record", async () => {
    email.broken = true;
    expect((await send()).status).toBe("sent");
    expect(msgs()).toHaveLength(1);
  });

  it("keeps picks of the site's own shape only, at most eight, and attaches them inline", async () => {
    const good = Array.from({ length: 10 }, (_, i) => `/work/nova/0${i}.jpg`);
    const res = await send({ ...GOOD, picks: [...good, "https://evil.example/x.jpg", "/work/../../etc/passwd"].join("\n") });
    expect(res.status).toBe("sent");
    const stored = kv.json(msgs()[0]);
    expect(stored.picks).toEqual(good.slice(0, 8));
    const inline = (email.sent[0].attachments as { disposition: string; contentId?: string }[]).filter((a) => a.disposition === "inline");
    expect(inline.map((a) => a.contentId)).toEqual(Array.from({ length: 8 }, (_, i) => `pick-${i}`));
  });

  it("stores uploaded images beside the enquiry, JPEG and PNG only, real ones, within the size limits", async () => {
    const HEIC = [0, 0, 0, 0x18, ...[..."ftypheic"].map((c) => c.charCodeAt(0))];
    const HEAD: Record<string, number[]> = { "image/jpeg": [0xff, 0xd8, 0xff], "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/heic": HEIC, "": HEIC };
    const img = (name: string, size: number, type = "image/jpeg", head = HEAD[type] ?? []) => {
      const b = new Uint8Array(size);
      b.set(head);
      return new File([b], name, { type });
    };
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], "x.svg", { type: "image/svg+xml" });
    const res = await send({
      ...GOOD,
      refs: [
        img("a.jpg", 1000),
        img("notes.pdf", 1000, "application/pdf"),
        svg,
        img("fake.jpg", 1000, "image/jpeg", [0x3c, 0x73, 0x76, 0x67]), // an SVG calling itself a JPEG
        img("huge.jpg", 7 * 1024 * 1024),
        img("b.png", 2000, "image/png"),
        img("c.heic", 1500, "image/heic"),
        img("d.HEIC", 1500, ""), // no type, as a browser that does not know HEIC sends it
        img("fake.heic", 1500, "image/heic", [0x3c, 0x73, 0x76, 0x67]),
      ],
    });
    expect(res.status).toBe("sent");
    const key = msgs()[0];
    expect(kv.json(key).files).toEqual(["a.jpg", "b.png", "c.heic", "d.HEIC"]);
    expect([...kv.data.keys()].filter((k) => k.startsWith(`ref:${key}:`)).length).toBe(4);
    expect(kv.data.get(`ref:${key}:1`)!.metadata).toEqual({ type: "image/png" });
    expect(kv.data.get(`ref:${key}:3`)!.metadata).toEqual({ type: "image/heic" });
  });

  it("keeps where it came from, checked, and mails it", async () => {
    ctx.cf = { country: "US", city: "San Jose", region: "California" };
    const context = JSON.stringify({
      page: "/book/events",
      path: "/",
      referrer: "https://www.instagram.com/juliangigola",
      utm: "source=ig",
      trail: ["/", "/portfolio/events", "javascript:alert(1)"],
      device: "phone",
    });
    await send({ ...GOOD, email: "ana@acme.studio", context });
    expect(kv.json(msgs()[0]).context).toEqual({
      page: "/book/events",
      landing: "/",
      referrer: "www.instagram.com",
      utm: "source=ig",
      trail: ["/", "/portfolio/events"],
      device: "phone",
      place: "San Jose, California, US",
    });
    const text = email.sent[0].text as string;
    expect(text).toContain("Came in: www.instagram.com to / (source=ig)");
    expect(text).toContain("Company: https://acme.studio");
    expect(text).not.toContain("Country: US");
  });

  it("stores no context when the browser sent none", async () => {
    ctx.cf = {};
    await send({ ...GOOD, email: "qa@gmail.com" });
    expect(kv.json(msgs()[0]).context).toBeUndefined();
    expect(email.sent[0].text).not.toContain("Company:");
  });

  it("files an unknown shoot type as other", async () => {
    await send({ ...GOOD, type: "<script>" });
    expect(kv.json(msgs()[0]).type).toBe("other");
  });
});
