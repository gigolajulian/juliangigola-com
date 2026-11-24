import { pad } from "@/lib/utils";

/** Minutes after midnight on a 12 hour clock: 785 is "1:05 PM". A day past midnight wraps (1455 is "12:15 AM"). */
export const clockLabel = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  return `${((h + 11) % 12) + 1}:${pad(m % 60)} ${h < 12 ? "AM" : "PM"}`;
};
