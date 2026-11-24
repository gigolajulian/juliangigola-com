import { upstreamError } from "@/lib/http";

/* ── San Jose's hourly forecast, for the sky picker's weather row ──
 * GET /api/weather answers Open-Meteo's `hourly` block as is: { time, temperature_2m, weather_code },
 * Pacific wall times ("2026-11-26T10:00"), °F, 16 days out. Free, no key. Proxied here because the
 * CSP's `connect-src` keeps the browser on this origin; kept an hour, since the forecast moves slowly.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const SOURCE = "https://api.open-meteo.com/v1/forecast?latitude=37.34&longitude=-121.89&hourly=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=16";

export async function GET() {
  try {
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const { hourly } = (await res.json()) as { hourly: unknown };
    return Response.json(hourly, { headers: { "cache-control": "public, max-age=3600", "x-robots-tag": "noindex, nofollow" } });
  } catch (e) {
    return upstreamError("weather", e, "No forecast.");
  }
}
