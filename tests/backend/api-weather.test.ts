import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/weather/route";
import { reply } from "./fakes";

/* /api/weather: Open-Meteo's `hourly` block passed through with an hour's
   cache-control, a failed upstream answered as 502 with a fixed line, and a
   copy in the colo's cache answered without calling Open-Meteo at all. */

const hourly = { time: ["2026-11-26T10:00", "2026-11-26T11:00"], temperature_2m: [58.1, 60.4], weather_code: [3, 1] };

/** A `caches.default` backed by a Map, keyed by URL. */
const edgeCache = () => {
  const kept = new Map<string, Response>();
  return {
    kept,
    default: {
      match: async (r: Request) => kept.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void kept.set(r.url, res),
    },
  };
};

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/weather", () => {
  it("answers the hourly block with an hour's cache-control", async () => {
    const fetch = vi.fn<(url: string) => Promise<Response>>(async () => reply({ latitude: 37.34, hourly }));
    vi.stubGlobal("fetch", fetch);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(hourly);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(String(fetch.mock.calls[0][0])).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
  });

  it("answers 502 with a fixed line when Open-Meteo fails", async () => {
    vi.stubGlobal("fetch", async () => reply({ error: true, reason: "down" }, 500));
    const res = await GET();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "No forecast." });
  });

  it("keeps the forecast in the colo's cache and answers the next call from it", async () => {
    const caches = edgeCache();
    vi.stubGlobal("caches", caches);
    const fetch = vi.fn(async () => reply({ hourly }));
    vi.stubGlobal("fetch", fetch);
    await GET();
    expect(caches.kept.size).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);

    const res = await GET();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(hourly);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });
});
