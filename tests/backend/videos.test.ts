import { describe, expect, it } from "vitest";
import {
  creditOf,
  embedUrl,
  filmCount,
  inSection,
  isValidId,
  parseVideoUrl,
  posterFor,
  previewUrl,
  sectionName,
  watchUrl,
  type Video,
} from "@/lib/videos";

/* What Julian pastes into the video form, read as a provider and an id,
   and the URLs built from one. An id lands in an iframe's src, so only
   the providers' own shapes pass. */

const YT = "dQw4w9WgXcQ";

describe("parseVideoUrl", () => {
  it.each([
    [YT, YT],
    [`https://youtu.be/${YT}`, YT],
    [`https://www.youtube.com/watch?v=${YT}&t=10`, YT],
    [`youtube.com/shorts/${YT}`, YT],
    [`https://www.youtube-nocookie.com/embed/${YT}`, YT],
  ])("reads YouTube's shapes: %s", (raw, id) => {
    expect(parseVideoUrl(raw)).toEqual({ provider: "youtube", videoId: id });
  });

  it.each([
    ["https://vimeo.com/123456789", "123456789"],
    ["https://vimeo.com/123456789/3b5d1f9a2c", "123456789"],
    ["https://vimeo.com/channels/staffpicks/123456789", "123456789"],
    ["https://vimeo.com/album/1234567/video/987654321", "987654321"],
    ["https://player.vimeo.com/video/123456789", "123456789"],
  ])("reads Vimeo's shapes: %s", (raw, id) => {
    expect(parseVideoUrl(raw)).toEqual({ provider: "vimeo", videoId: id });
  });

  it("returns null rather than guessing", () => {
    for (const raw of ["", "   ", "https://example.com/watch?v=" + YT, "https://youtu.be/short", "https://vimeo.com/channels/staffpicks", "javascript:alert(1)", "123456789"])
      expect(parseVideoUrl(raw), raw).toBeNull();
  });

  it("checks ids against each provider's alphabet", () => {
    expect(isValidId("youtube", YT)).toBe(true);
    expect(isValidId("youtube", `${YT}"`)).toBe(false);
    expect(isValidId("vimeo", "12345")).toBe(false);
    expect(isValidId("vimeo", "123456")).toBe(true);
  });
});

describe("URLs from a video", () => {
  const yt = { provider: "youtube", videoId: YT, title: "Pear VC Campaign", client: "Pear VC", section: "commercial" } as Video;
  const vm = { provider: "vimeo", videoId: "123456789", title: "Song", section: "music", previewAt: -3 } as Video;

  it("plays from the cookie-free hosts", () => {
    expect(embedUrl(yt)).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1/);
    expect(embedUrl(vm)).toContain("dnt=1");
    expect(watchUrl(vm)).toBe("https://vimeo.com/123456789");
  });
  it("previews muted from a start time never below zero", () => {
    expect(previewUrl(yt)).toContain("mute=1&controls=0&start=8&loop=1&playlist=dQw4w9WgXcQ");
    expect(previewUrl(vm)).toMatch(/#t=0s$/);
  });
  it("has a poster for YouTube only, unless one is set", () => {
    expect(posterFor(yt)).toBe(`https://i.ytimg.com/vi/${YT}/hqdefault.jpg`);
    expect(posterFor(vm)).toBeNull();
    expect(posterFor({ ...vm, poster: "/p.jpg" })).toBe("/p.jpg");
  });
  it("credits the client unless the title already names them", () => {
    expect(creditOf(yt)).toBeUndefined();
    expect(creditOf({ title: "Night drive", client: "Pear VC" })).toBe("Pear VC");
  });
  it("counts the reel with the films and splits by section", () => {
    expect(filmCount([1, 2])).toBe(3);
    expect(inSection([yt, vm], "music")).toEqual([vm]);
    expect(sectionName("music")).not.toBe("Video");
  });
});
