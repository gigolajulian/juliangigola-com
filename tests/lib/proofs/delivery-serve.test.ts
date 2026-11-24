import { describe, expect, it } from "vitest";
import { deliveryDownload } from "@/lib/proofs/delivery-serve";

describe("deliveryDownload", () => {
  const env = {} as never;
  it("leaves other paths and methods to Next", () => {
    expect(deliveryDownload(new Request("https://x/delivery/11082026-k7m2q9xd"), env)).toBeNull();
    expect(deliveryDownload(new Request("https://x/delivery/11082026-k7m2q9xd/zip", { method: "POST" }), env)).toBeNull();
  });
  it("answers a broken %-escape with 404, not a 500", async () => {
    expect((await deliveryDownload(new Request("https://x/delivery/%E0%A4%A/zip"), env))?.status).toBe(404);
    expect((await deliveryDownload(new Request("https://x/delivery/11082026-k7m2q9xd/dl/%E0%A4%A"), env))?.status).toBe(404);
  });
});
