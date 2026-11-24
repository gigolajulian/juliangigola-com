import { expect, test } from "vitest";
import { partOf, sunsetLabel, sunHint, skyColors, weatherAt, weatherWord } from "@/lib/booking/sky";

// Pacific wall time to an instant: the offsets are the real ones for these dates.
const at = (ymd: string, hhmm: string, off: string) => Date.parse(`${ymd}T${hhmm}:00${off}`);
const hue = (c: string) => Number(c.match(/oklch\(\S+ \S+ (\S+)\)/)![1]);
const light = (c: string) => Number(c.match(/oklch\((\S+)/)![1]);

test("sunset in San Jose follows the season and DST", () => {
  expect(sunsetLabel("2026-11-26")).toMatch(/^4:5[0-3] PM$/);
  expect(sunsetLabel("2026-03-07")).toMatch(/^6:0[4-8] PM$/);
  expect(sunsetLabel("2026-03-09")).toMatch(/^7:0[6-9] PM$/); // the day after the spring change
  expect(sunsetLabel("2026-06-21")).toMatch(/^8:3[0-4] PM$/);
});

test("the hours run gold, coral, cobalt, and never purple", () => {
  expect(hue(skyColors(at("2026-11-26", "10:00", "-08:00")).dark)).toBeGreaterThan(60); // gold
  expect(hue(skyColors(at("2026-11-26", "17:00", "-08:00")).dark)).toBeLessThan(45); // coral
  expect(hue(skyColors(at("2026-11-26", "19:00", "-08:00")).dark)).toBeGreaterThan(240); // cobalt
  for (const ymd of ["2026-01-15", "2026-03-09", "2026-06-21", "2026-11-02"]) {
    for (let h = 10; h <= 20; h += 0.25) {
      const c = skyColors(Date.parse(`${ymd}T12:00:00Z`) + (h - 12) * 36e5 + 8 * 36e5);
      const hh = hue(c.dark);
      expect(hh > 285 && hh < 345, `${ymd} ${h}: ${c.dark}`).toBe(false);
    }
  }
});

test("a June evening is still warm where November's is blue", () => {
  expect(hue(skyColors(at("2026-06-21", "19:00", "-07:00")).dark)).toBeLessThan(80);
  expect(hue(skyColors(at("2026-11-26", "19:00", "-08:00")).dark)).toBeGreaterThan(240);
});

test("the light ground gets the darker set", () => {
  const t = skyColors(at("2026-11-26", "10:00", "-08:00"));
  expect(light(t.light)).toBeLessThanOrEqual(0.5);
  expect(light(t.dark)).toBeGreaterThan(0.8);
});

test("parts of the day and the sun hint", () => {
  expect([partOf(600), partOf(720), partOf(1019), partOf(1020)]).toEqual([0, 1, 1, 2]);
  expect(sunHint(at("2026-11-26", "16:00", "-08:00"))).toMatch(/min to sunset$/);
  expect(sunHint(at("2026-11-26", "19:00", "-08:00"))).toMatch(/after sunset$/);
});

test("weather: WMO codes in plain words, read at the start's Pacific hour", () => {
  expect([0, 2, 3, 45, 53, 63, 75, 81, 86, 95].map(weatherWord)).toEqual(["Clear", "Partly cloudy", "Cloudy", "Fog", "Drizzle", "Rain", "Snow", "Showers", "Snow", "Thunderstorms"]);
  const hourly = { time: ["2026-11-26T10:00", "2026-11-26T11:00"], temperature_2m: [58.4, 61.6], weather_code: [3, 0] };
  expect(weatherAt(hourly, at("2026-11-26", "11:30", "-08:00"))).toBe("Clear, 62°");
  expect(weatherAt(hourly, at("2026-11-27", "11:00", "-08:00"))).toBeNull(); // past the forecast
  expect(weatherAt(null, at("2026-11-26", "10:00", "-08:00"))).toBeNull(); // fetch failed
});
