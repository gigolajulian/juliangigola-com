import { describe, expect, it } from "vitest";
import { plainSrc } from "@/image-loader";

describe("plainSrc", () => {
  it("keeps a provider still on its own host", () => {
    const yt = "https://i.ytimg.com/vi/lmR6-qjutn0/maxresdefault.jpg";
    expect(plainSrc(`https://juliangigola.com/cdn-cgi/image/width=640,quality=78,format=auto/${yt}`)).toBe(yt);
    expect(plainSrc(`/cdn-cgi/image/width=640/https:/i.ytimg.com/vi/x/1.jpg`)).toBe("https://i.ytimg.com/vi/x/1.jpg");
  });
  it("puts our own pictures back on this host", () => {
    expect(plainSrc("https://juliangigola.com/cdn-cgi/image/width=640/work/a/1.jpg")).toBe("/work/a/1.jpg");
  });
  it("leaves anything not resized alone", () => {
    expect(plainSrc("/work/a/1.jpg")).toBeNull();
  });
});
