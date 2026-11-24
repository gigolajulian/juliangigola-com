import { describe, expect, it } from "vitest";
import { cleanSettings, deliveryView, publicView, type Proof } from "@/lib/proofs/proof-model";

/* Gate polish (Julian 2026-11-15): a subheading under the gate's heading, and file names on thumbnails only when he turns them on. */

const p = (over: Partial<Proof> = {}): Proof => ({ token: "11152026-k7m2q9xd", name: "Nov 1 portraits", included: 2, price: 15, days: 14, createdAt: "2026-11-01T00:00:00Z", frames: [{ id: "a", file: "ANA_041.jpg", w: 1, h: 1 }], finals: [{ id: "a", file: "ANA_041.jpg", w: 1, h: 1, bytes: 1, crc: 0 }], selects: [], notes: {}, views: 0, ...over });

describe("gate polish", () => {
  it("cleans the subheading and the labels switch", () => {
    expect(cleanSettings({ subhead: "  Ana   Ruiz, Nov 1 " })).toEqual({ subhead: "Ana Ruiz, Nov 1" });
    expect(cleanSettings({ subhead: "" })).toEqual({ subhead: undefined });
    expect(cleanSettings({ subhead: "x".repeat(200) }).subhead).toHaveLength(80);
    expect(cleanSettings({ labels: true })).toEqual({ labels: true });
    expect(cleanSettings({ labels: false })).toEqual({ labels: undefined });
  });

  it("file names reach the client only with labels on; never the Lightroom collection name", () => {
    expect(JSON.stringify(publicView(p()))).not.toContain("ANA_041");
    expect(publicView(p({ labels: true })).frames[0]).toMatchObject({ file: "ANA_041.jpg" });
    const v = publicView(p({ subhead: "Ana, Nov 1" }));
    expect(v.subhead).toBe("Ana, Nov 1");
    expect(JSON.stringify(v)).not.toContain("Nov 1 portraits");
    expect(deliveryView(p({ subhead: "Ana", labels: true }))).toMatchObject({ subhead: "Ana", labels: true });
  });
});
