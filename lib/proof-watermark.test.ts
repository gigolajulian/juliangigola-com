import { describe, expect, it, vi } from "vitest";
import { markBox, servedFrame } from "@/lib/proof-watermark";

/** R2 in memory, and an Images binding that records what it was asked to draw. */
function fakeEnv(stored: Record<string, string>) {
  const r2 = new Map(Object.entries(stored).map(([k, v]) => [k, new TextEncoder().encode(v).buffer as ArrayBuffer]));
  const obj = (b: ArrayBuffer) => ({ body: new Response(b).body!, httpEtag: `"${b.byteLength}"`, arrayBuffer: async () => b });
  const draws: unknown[] = [];
  const env = {
    PROOFS: {
      get: async (k: string) => (r2.has(k) ? obj(r2.get(k)!) : null),
      put: async (k: string, b: ArrayBuffer) => (r2.set(k, b), { httpEtag: '"wm"' }),
    },
    ASSETS: { fetch: vi.fn(async () => new Response("png")) },
    IMAGES: {
      info: async () => ({ width: 1333, height: 2000 }),
      input: (s: ReadableStream) => ({
        transform: (t: unknown) => ({ mark: s, t }),
        draw: (o: unknown, at: unknown) => (draws.push({ o, at }), { output: async () => ({ response: () => new Response("marked") }) }),
      }),
    },
  };
  return { env: env as unknown as Parameters<typeof servedFrame>[0], r2, draws };
}
const text = async (o: { body: ReadableStream } | null) => (o ? new Response(o.body).text() : null);

describe("proof watermark", () => {
  it("sits centered across, in the bottom third, sized off the short side", () => {
    const b = markBox(1333, 2000);
    expect(b.width).toBe(800);
    expect(b.left).toBe(267);
    expect(b.top + 137 / 2).toBeCloseTo((2000 * 5) / 6, 0);
    expect(b.top).toBeGreaterThan(2000 * (2 / 3));
    expect(markBox(2000, 1333).width).toBe(800);
  });
  it("serves the clean frame when off", async () => {
    const { env, draws } = fakeEnv({ "T/a.jpg": "clean" });
    expect(await text(await servedFrame(env, { token: "T", watermark: false }, "a", "https://x"))).toBe("clean");
    expect(draws).toHaveLength(0);
  });
  it("bakes an already uploaded frame once, keeps the original, then serves the kept copy", async () => {
    const { env, r2, draws } = fakeEnv({ "T/a.jpg": "clean" });
    expect(await text(await servedFrame(env, { token: "T", watermark: true }, "a", "https://x"))).toBe("marked");
    expect(new TextDecoder().decode(r2.get("T/a.jpg"))).toBe("clean");
    expect(r2.has("T/a.wm1.jpg")).toBe(true);
    expect(draws[0]).toMatchObject({ at: { opacity: 0.5, left: 267 } });
    expect(await text(await servedFrame(env, { token: "T", watermark: true }, "a", "https://x"))).toBe("marked");
    expect(draws).toHaveLength(1);
  });
  it("never falls back to the clean frame when the mark cannot be drawn", async () => {
    const { env } = fakeEnv({ "T/a.jpg": "clean" });
    (env.ASSETS.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(servedFrame(env, { token: "T", watermark: true }, "a", "https://x")).rejects.toThrow();
  });
  it("is null for a frame that is not in R2", async () => {
    const { env } = fakeEnv({});
    expect(await servedFrame(env, { token: "T", watermark: true }, "a", "https://x")).toBeNull();
  });
});
