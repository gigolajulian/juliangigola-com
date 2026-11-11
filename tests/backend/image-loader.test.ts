import { afterEach, describe, expect, it, vi } from "vitest";

/* Every photograph's URL (`image-loader.ts`): the sized-copy ladder, the
   fallback past the widest copy, and the resizer's path with the CDN on.
   CDN is read once at import, so each case imports the loader fresh. */

const load = async (cdn: boolean) => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_IMAGE_CDN", cdn ? "1" : "0");
  return (await import("@/image-loader")).default;
};

afterEach(() => vi.unstubAllEnvs());

describe("image loader, CDN off", () => {
  it("takes the smallest sized copy wide enough", async () => {
    const loader = await load(false);
    expect(loader({ src: "/work/iris/01.jpg", width: 500 })).toBe("/work/iris/01-w640.jpg");
    expect(loader({ src: "/work/iris/01.jpg", width: 900 })).toBe("/work/iris/01-w1080.jpg");
  });

  it("past the widest copy, a scrub frame is its own master and a cover its full frame", async () => {
    const loader = await load(false);
    expect(loader({ src: "/work/iris/01.jpg", width: 2400 })).toBe("/work/iris/01.jpg");
    expect(loader({ src: "/work/paradox/cover.jpg", width: 2400 })).toBe("/work/paradox/01.jpg");
  });

  it("a hero past its widest copy takes the widest", async () => {
    const loader = await load(false);
    expect(loader({ src: "/hero/a.jpg", width: 3000 })).toBe("/hero/a-w1920.jpg");
  });

  it("leaves an absolute URL alone", async () => {
    const loader = await load(false);
    expect(loader({ src: "https://i.ytimg.com/vi/x/hq.jpg", width: 400 })).toBe("https://i.ytimg.com/vi/x/hq.jpg");
  });
});

describe("image loader, CDN on", () => {
  it("sends the sized copy through the resizer with one slash", async () => {
    const loader = await load(true);
    expect(loader({ src: "/work/iris/01.jpg", width: 500 })).toBe("/cdn-cgi/image/width=500,quality=78,format=auto/work/iris/01-w640.jpg");
  });

  it("sizes a provider still and keeps a given quality", async () => {
    const loader = await load(true);
    expect(loader({ src: "https://i.ytimg.com/vi/x/hq.jpg", width: 400, quality: 82 })).toBe("/cdn-cgi/image/width=400,quality=82,format=auto/https://i.ytimg.com/vi/x/hq.jpg");
    expect(loader({ src: "https://example.com/a.jpg", width: 400 })).toBe("https://example.com/a.jpg");
  });
});
