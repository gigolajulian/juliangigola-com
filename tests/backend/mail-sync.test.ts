import { expect, it, vi } from "vitest";
import { copySheet, syncMail } from "@/worker/index";

/* The 15-minute cron runs syncMail then copySheet. A failed Gmail read must not skip the Sheet copy. */

it("syncMail logs a network failure instead of throwing, so the Sheet copy still runs", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const hits: string[] = [];
  const env = {
    BOOKING_SECRET: "s",
    SITE: { fetch: async (url: string) => (hits.push(url), url.endsWith("/gmail") ? Promise.reject(new Error("network")) : new Response("ok")) },
  } as never;
  await syncMail(env).then(() => copySheet(env));
  expect(hits.map((u) => u.split("/").pop())).toEqual(["gmail", "sheet"]);
});
