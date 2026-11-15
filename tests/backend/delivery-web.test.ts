import { beforeEach, describe, expect, it } from "vitest";
import { deliveryDownload, webName } from "@/lib/proofs/delivery-serve";
import { sealer } from "@/lib/leads/lead-crypto";
import { finalKey, PREVIEW_W, writeProof, type Proof } from "@/lib/proofs/proof";
import { FakeKV, LEADS_KEY } from "./fakes";

/* Save for web (Julian 2026-11-15): the 2000px copy as `<file> web.jpg`, with its length, through worker.ts. */

const ID = "11152026-k7m2q9xd";
let env: Record<string, unknown>;
let asked: string[];
beforeEach(async () => {
  const kv = new FakeKV();
  asked = [];
  env = {
    INBOX: kv, LEADS_KEY,
    PROOFS: { get: async (k: string) => (asked.push(k), { body: new Response("webcopy").body, size: 7 }) },
    DOWNLOAD_LIMIT: { limit: async () => ({ success: true }) },
  };
  const p = { token: ID, name: "Ana", included: 2, price: 15, days: 14, createdAt: "2026-11-01T00:00:00Z", frames: [], finals: [{ id: "a", file: "DSC0001.jpg", w: 1, h: 1, bytes: 9, crc: 0 }], selects: [], notes: {}, views: 0 };
  await writeProof(kv as never, (await sealer(LEADS_KEY))!, p as Proof);
});

describe("Save for web", () => {
  it("names the file after the final", () => {
    expect(webName("DSC0001.jpg")).toBe("DSC0001 web.jpg");
    expect(webName("look 2.final.JPEG")).toBe("look 2.final web.jpg");
  });

  it("serves the 2000px copy as an attachment with its length", async () => {
    const res = (await deliveryDownload(new Request(`https://x/delivery/${ID}/web/a`), env as never))!;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe("7");
    expect(res.headers.get("content-disposition")).toContain("DSC0001%20web.jpg");
    expect(asked).toEqual([finalKey(ID, "a", PREVIEW_W)]);
    expect(await res.text()).toBe("webcopy");
  });

  it("is a 404 for an unknown final, and Save still gets the full file", async () => {
    expect((await deliveryDownload(new Request(`https://x/delivery/${ID}/web/zz`), env as never))!.status).toBe(404);
    await deliveryDownload(new Request(`https://x/delivery/${ID}/dl/a`), env as never);
    expect(asked.at(-1)).toBe(finalKey(ID, "a"));
  });
});
