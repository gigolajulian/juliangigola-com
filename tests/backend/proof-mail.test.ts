import { describe, expect, it, vi } from "vitest";
import { alertLines, proofMail, proofUrl, receiptMail, sendClient } from "@/lib/email/proof-mail";
import type { Proof } from "@/lib/proofs";

/* The proof mails: what the client and Julian read, and the send that
   falls back to a plain copy when the inline frames are refused. */

const proof = (over: Partial<Proof> = {}): Proof => ({
  token: "tok123",
  name: "Nov 1 portraits",
  email: "kai@x.co",
  included: 10,
  price: 25,
  days: 14,
  createdAt: "2026-11-01T00:00:00Z",
  frames: [
    { id: "a", file: "A.jpg", w: 1, h: 1 },
    { id: "b", file: "B.jpg", w: 1, h: 1 },
    { id: "c", file: "C.jpg", w: 1, h: 1 },
  ],
  selects: [],
  notes: {},
  views: 0,
  ...over,
});

describe("proofMail", () => {
  it("links the gallery, counts the frames and escapes the note", () => {
    const m = proofMail(proof({ note: "<script>x</script>", closesAt: "2026-11-20T20:00:00Z" }), [{ id: "a", bytes: new Uint8Array([1]) }]);
    expect(proofUrl("tok123")).toBe("https://juliangigola.com/proof/tok123");
    expect(m.text).toContain("All 3 frames are up. Select the ten you want");
    expect(m.text).toContain("Open until: Fri, Nov 20");
    expect(m.text).toContain("See your proofs: https://juliangigola.com/proof/tok123");
    expect(m.html).not.toContain("<script>x");
    expect(m.attachments.map((a) => a.contentId)).toEqual(["name-ink", "name-w", "f-a"]);
  });
});

describe("receiptMail", () => {
  it("lists the selects with their notes and what was paid", () => {
    const m = receiptMail(proof({ selects: ["b", "a"], notes: { b: "brighter" }, paid: { session: "cs_test_1", amount: 2550, at: "" } }));
    expect(m.text).toContain("I have your 2 frames and your notes.");
    expect(m.text).toContain("Paid: $25.50");
    expect(m.text).toContain("B.jpg · brighter\nA.jpg");
  });
});

describe("alertLines", () => {
  it("does the extras sum and says a bank payment is still clearing", () => {
    const sel = Array.from({ length: 12 }, (_, i) => `f${i}`);
    const a = alertLines(proof({ selects: sel, submittedBy: "kai@x.co", balance: 200, paid: { session: "s", amount: 25000, at: "", pending: true } }));
    expect(a.subject).toBe("Selects in: Nov 1 portraits (12, $250 paid by bank, clearing in about 4 business days)");
    expect(a.lines).toContain("Shoot balance: $200.");
    expect(a.lines).toContain("10 included · 2 extra × $25 = $50.");
  });
});

describe("sendClient", () => {
  const m = { subject: "S", text: "t", html: '<img src="cid:name-ink"><tr><td style="padding-bottom:30px"><table>frames</table></td></tr>', attachments: [] };

  it("is false with no mailer", async () => {
    expect(await sendClient(undefined, "a@b.c", m)).toBe(false);
  });
  it("sends again without the inline parts when the first send is refused", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("inline refused")).mockResolvedValueOnce(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendClient({ send } as never, "a@b.c", m)).toBe(true);
    const second = send.mock.calls[1][0];
    expect(second).not.toHaveProperty("attachments");
    expect(second.html).not.toContain("frames");
    expect(second.html).toContain("https://juliangigola.com/email-name-ink.png");
  });
  it("is false when both sends fail", async () => {
    const send = vi.fn().mockRejectedValue(new Error("down"));
    expect(await sendClient({ send } as never, "a@b.c", m)).toBe(false);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
