import { beforeEach, describe, expect, it, vi } from "vitest";
import { sealer } from "@/lib/leads/lead-crypto";
import { writeProof, type Proof } from "@/lib/proofs/proof";
import { FakeKV, LEADS_KEY } from "./fakes";

/* /proof/<token>/f/<id> and /proof/<token>/card: a proof frame and the
   gallery's link card, only while the gallery is open. The watermark
   itself is `lib/proofs/watermark.ts` and has its own tests; here it is a
   stand-in that says what it was asked for. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("./fakes")).cloudflareMock(ctx));
const mark = vi.hoisted(() => ({ servedSize: vi.fn(), shareCard: vi.fn() }));
vi.mock("@/lib/proofs/watermark", () => mark);

const { GET: frame } = await import("@/app/proof/[token]/f/[id]/route");
const { GET: card } = await import("@/app/proof/[token]/card/route");

const TOKEN = "AbCdEfGh12345678";
let kv: FakeKV;
const base = { token: TOKEN, name: "Test", included: 2, price: 15, days: 14, frames: [{ id: "a", file: "a.jpg", w: 1, h: 1 }], selects: [], notes: {}, views: 0 };
const store = async (p: Partial<Proof> = {}) => writeProof(kv as never, (await sealer(LEADS_KEY))!, { ...base, createdAt: new Date().toISOString(), ...p } as Proof);

beforeEach(async () => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, PROOFS: {}, LEADS_KEY };
  mark.servedSize.mockReset().mockResolvedValue({ body: "jpeg", etag: '"e1"' });
  mark.shareCard.mockReset().mockResolvedValue({ body: "card", etag: '"c1"' });
  await store();
});

const getFrame = (id: string, query = "", token = TOKEN) =>
  frame(new Request(`https://juliangigola.com/proof/${token}/f/${id}${query}`), { params: Promise.resolve({ token, id }) });
const getCard = (token = TOKEN) => card(new Request(`https://juliangigola.com/proof/${token}/card`), { params: Promise.resolve({ token }) });

describe("/proof/[token]/f/[id]", () => {
  it("serves a frame of an open gallery, privately cached and never indexed", async () => {
    const res = await getFrame("a");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("jpeg");
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow, noimageindex");
    expect(res.headers.get("etag")).toBe('"e1"');
    expect(mark.servedSize.mock.calls[0][4]).toBe(false);
  });

  it("asks for the small copy only for ?w=800", async () => {
    await getFrame("a", "?w=800");
    await getFrame("a", "?w=400");
    expect(mark.servedSize.mock.calls.map((c) => c[4])).toEqual([true, false]);
  });

  it("is a 404 for a bad token or id, a frame not in the gallery, or a gallery that is offline", async () => {
    expect((await getFrame("a", "", "../x")).status).toBe(404);
    expect((await getFrame("a/b")).status).toBe(404);
    expect((await getFrame("zz")).status).toBe(404);
    await store({ offline: true });
    expect((await getFrame("a")).status).toBe(404);
    expect(mark.servedSize).not.toHaveBeenCalled();
  });

  it("is a 503 to retry when the frame cannot be drawn, and a 404 when it is gone", async () => {
    mark.servedSize.mockRejectedValueOnce(new Error("Images down")).mockResolvedValueOnce(null);
    const busy = await getFrame("a");
    expect(busy.status).toBe(503);
    expect(busy.headers.get("retry-after")).toBe("5");
    expect((await getFrame("a")).status).toBe(404);
  });

  it("serves a renamed gallery by its new link only", async () => {
    const link = "20261101-abcdefgh";
    await store({ link });
    await kv.put(`proofalias:${link}`, TOKEN);
    expect((await getFrame("a", "", link)).status).toBe(200);
    expect((await getFrame("a")).status).toBe(404);
    expect((await getCard(link)).status).toBe(200);
    expect((await getCard()).status).toBe(404);
  });

  it("is a 404 without the bindings", async () => {
    ctx.env = { INBOX: kv, LEADS_KEY };
    expect((await getFrame("a")).status).toBe(404);
  });
});

describe("/proof/[token]/card", () => {
  it("serves the card publicly cached for an hour", async () => {
    const res = await getCard();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });

  it("is a 404 for an unknown gallery or one with no card, and a 503 when it cannot be drawn", async () => {
    expect((await getCard("ZzZzZzZz87654321")).status).toBe(404);
    mark.shareCard.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("down"));
    expect((await getCard()).status).toBe(404);
    expect((await getCard()).status).toBe(503);
  });
});
