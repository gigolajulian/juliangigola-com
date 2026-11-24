import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/proof/route";
import { sealer } from "@/lib/leads/lead-crypto";
import { subjectOr } from "@/lib/email/proof-mail";
import type { Proof } from "@/lib/proofs/proof-model";
import { writeProof } from "@/lib/proofs/proof-store";
import { FakeKV, LEADS_KEY } from "./fakes";

/* The mail's subject, edited on the desk before Send (Julian 2026-11-15). */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("./fakes")).cloudflareMock(ctx));

const ID = "11152026-k7m2q9xd";
let kv: FakeKV;
let sent: { subject: string }[];
const req = (method: string, body?: unknown, query = "") => new Request(`https://juliangigola.com/api/proof${query}`, { method, body: body ? JSON.stringify(body) : undefined, headers: { "x-admin-key": "k" } });
beforeEach(async () => {
  kv = new FakeKV();
  sent = [];
  ctx.env = { INBOX: kv, INBOX_KEY: "k", LEADS_KEY, PROOFS: { delete: async () => {}, get: async () => null }, CLIENT_EMAIL: { send: async (m: { subject: string }) => void sent.push(m) } };
  const p = { token: ID, name: "Ana", email: "ana@gmail.com", included: 2, price: 15, days: 14, createdAt: "2026-11-01T00:00:00Z", frames: [{ id: "a", file: "a.jpg", w: 1, h: 1 }], finals: [{ id: "a", file: "a.jpg", w: 1, h: 1, bytes: 1, crc: 1 }], selects: [], notes: {}, views: 0 };
  await writeProof(kv as never, (await sealer(LEADS_KEY))!, p as Proof);
});

describe("mail subject", () => {
  it("keeps one clean line, at most 150, and falls back when empty", () => {
    expect(subjectOr("  Your Nov 1 photos\r\nBcc: x@y.z ", "Default")).toBe("Your Nov 1 photos Bcc: x@y.z");
    expect(subjectOr("   ", "Default")).toBe("Default");
    expect(subjectOr(undefined, "Default")).toBe("Default");
    expect(subjectOr("x".repeat(300), "D")).toHaveLength(150);
  });

  it("Send finals goes out with Julian's subject, or the default", async () => {
    expect((await POST(req("POST", { action: "deliver", token: ID, subject: "Ana, your studio photos" })))!.status).toBe(200);
    expect(sent.map((m) => m.subject)).toEqual(["Ana, your studio photos"]);
  });

  it("the preview answers the default subject for the desk to edit", async () => {
    const o = await (await GET(req("GET", undefined, `?preview=${ID}`)))!.json();
    expect(o.subject).toBe("Your proofs are ready");
  });
});
