import { describe, expect, it } from "vitest";
import { filmRange, parseRange } from "@/lib/films-range";

const FILE = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));
// assets in chunks of 7, like a real stream, with the length assets send
const assets = {
  fetch: async (req: Request) => {
    expect(new URL(req.url).pathname).toBe("/films/reel.mp4");
    let i = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (i >= FILE.length) return c.close();
        c.enqueue(FILE.slice(i, i + 7));
        i += 7;
      },
    });
    return new Response(req.method === "HEAD" ? null : body, { status: 200, headers: { "content-length": "100", "content-type": "video/mp4" } });
  },
};
const ask = (range?: string, method = "GET", path = "/stream/reel.mp4") =>
  filmRange(new Request("https://juliangigola.com" + path, { method, headers: range ? { range } : {} }), { ASSETS: assets });

describe("parseRange", () => {
  it("reads one range and clamps it", () => {
    expect(parseRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
    expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=95-500", 100)).toEqual({ start: 95, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });
  it("whole file for none, several or junk; bad when it can't be met", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("bytes=0-1,5-6", 100)).toBeNull();
    expect(parseRange("bytes=100-", 100)).toBe("bad");
    expect(parseRange("bytes=9-3", 100)).toBe("bad");
  });
});

describe("filmRange", () => {
  it("serves the bytes asked for as 206", async () => {
    const r = (await ask("bytes=10-24"))!;
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe("bytes 10-24/100");
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([...FILE.slice(10, 25)]);
  });
  it("the whole file with Accept-Ranges when no range is asked", async () => {
    const r = (await ask())!;
    expect(r.status).toBe(200);
    expect(r.headers.get("accept-ranges")).toBe("bytes");
    expect((await r.arrayBuffer()).byteLength).toBe(100);
  });
  it("416 past the end, 206 headers only for HEAD, other paths untouched", async () => {
    expect((await ask("bytes=200-"))!.status).toBe(416);
    const h = (await ask("bytes=0-1", "HEAD"))!;
    expect(h.status).toBe(206);
    expect(h.headers.get("content-length")).toBe("2");
    expect(await ask("bytes=0-1", "GET", "/films/reel.mp4")).toBeNull();
    expect(await ask("bytes=0-1", "GET", "/stream/../x.mp4")).toBeNull();
  });
});
