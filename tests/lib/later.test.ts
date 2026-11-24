import { expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => { throw new Error("no worker"); } }));

const { later } = await import("@/lib/later");

it("runs the work inline when there is no request context", async () => {
  let done = false;
  await later(Promise.resolve().then(() => void (done = true)));
  expect(done).toBe(true);
});
