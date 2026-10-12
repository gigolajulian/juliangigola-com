import { describe, expect, it, vi } from "vitest";
import worker from "@/book/worker.js";

/* book.juliangigola.com (`book/worker.js`): the four sessions go to the
   site's own picker, the calls stay on the static Cal.com page, and each
   call's link preview gets its own title. HTMLRewriter is the Workers
   runtime's; here a stand-in records what it was told to set. */

const assets = (contentType = "text/html") => ({
  fetch: vi.fn(async () => new Response("<html></html>", { headers: { "content-type": contentType } })),
});

class Rewriter {
  static set: Record<string, string> = {};
  on(selector: string, handler: { element?: (el: { setAttribute: (n: string, v: string) => void }) => void }) {
    handler.element?.({ setAttribute: (_n, v) => (Rewriter.set[selector] = v) });
    return this;
  }
  transform(res: Response) {
    return res;
  }
}
vi.stubGlobal("HTMLRewriter", Rewriter);

const go = (path: string, env = { ASSETS: assets() }) => worker.fetch(new Request(`https://book.juliangigola.com${path}`), env);

describe("book.juliangigola.com", () => {
  it("sends the bare domain to /book, as a 302", async () => {
    const res = await go("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://juliangigola.com/book");
  });

  it.each([
    ["portraits", "portraits"],
    ["graduation", "graduation"],
    ["headshots", "headshots"],
    ["digitals", "studio-digitals"],
  ])("sends /%s to the site's picker for %s", async (path, session) => {
    const env = { ASSETS: assets() };
    const res = await go(`/${path}`, env);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`https://juliangigola.com/book?session=${session}`);
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it("serves a call's page with its own preview title and image", async () => {
    Rewriter.set = {};
    const res = await go("/editorial");
    expect(res.status).toBe(200);
    expect(Rewriter.set['meta[property="og:title"]']).toBe("Editorial call");
    expect(Rewriter.set['meta[property="og:image"]']).toBe("https://book.juliangigola.com/og-editorial.jpg");
  });

  it("passes other files through untouched", async () => {
    Rewriter.set = {};
    const env = { ASSETS: assets("image/jpeg") };
    const res = await go("/og-campaign.jpg", env);
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce();
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(Rewriter.set).toEqual({});
  });
});
