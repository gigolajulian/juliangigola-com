import { HttpError, upstreamError } from "@/lib/http";

/* ── San Jose's hourly forecast, for the sky picker's weather row ──
 * GET /api/weather answers Open-Meteo's `hourly` block as is: { time, temperature_2m, weather_code },
 * Pacific wall times ("2026-11-26T10:00"), °F, 16 days out. Free, no key. Proxied here because the
 * CSP's `connect-src` keeps the browser on this origin. Kept an hour in the colo's cache and the browser,
 * since the forecast moves slowly, so Open-Meteo sees about one call an hour per colo.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const SOURCE = "https://api.open-meteo.com/v1/forecast?latitude=37.34&longitude=-121.89&hourly=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=16";

const HEADERS = { "cache-control": "public, max-age=3600", "x-robots-tag": "noindex, nofollow" };
const edge = () => (globalThis as { caches?: { default?: Cache } }).caches?.default;

export async function GET() {
  const cache = edge();
  const key = new Request("https://weather-cache.invalid/v1/san-jose");
  const kept = await cache?.match(key).catch(() => undefined);
  if (kept) return Response.json(await kept.json(), { headers: HEADERS });
  try {
    const res = await fetch(SOURCE);
    if (!res.ok) throw new HttpError(`open-meteo ${res.status}`, res.status);
    const { hourly } = (await res.json()) as { hourly: unknown };
    await cache?.put(key, Response.json(hourly, { headers: { "cache-control": "max-age=3600" } })).catch(() => {});
    return Response.json(hourly, { headers: HEADERS });
  } catch (e) {
    return upstreamError("weather", e, "No forecast.");
  }
}
