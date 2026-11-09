import { describe, expect, it } from "vitest";
import { AMOUNT } from "./deposit";
import { balance, cleanInvoice, dayB, DEPOSIT, invoiceNo, MAX_ROWS_B, mmyy, usdB } from "./invoice";

describe("invoice", () => {
  it("numbers by month: 1126, 1126-2, 1126-3", () => {
    expect(mmyy("2026-11-06")).toBe("1126");
    expect([0, 1, 2].map((n) => invoiceNo("2026-11-30", n))).toEqual(["1126", "1126-2", "1126-3"]);
  });
  it("takes the deposit off to the cent", () => {
    expect(balance({ lines: [{ desc: "a", qty: 1, rate: 450 }, { desc: "b", qty: 3, rate: 0.1 }], paid: 100 })).toBe(350.3);
  });
  it("matches the deposit the site charges", () => expect(DEPOSIT * 100).toBe(AMOUNT));
  it("refuses empty lines, a bad date and a negative deposit", () => {
    expect(cleanInvoice({ date: "2026-11-06", lines: [] })).toHaveProperty("error");
    expect(cleanInvoice({ date: "11/6/2026", lines: [{ desc: "a", qty: 1, rate: 1 }] })).toHaveProperty("error");
    expect(cleanInvoice({ date: "2026-11-06", lines: [{ desc: "a", qty: 1, rate: 1 }], paid: -5 })).toHaveProperty("error");
    expect(cleanInvoice({ date: "2026-11-06", lines: [{ desc: " a ", qty: 1, rate: 1 }] })).toEqual({ date: "2026-11-06", lines: [{ desc: "a", qty: 1, rate: 1 }], paid: 0 });
  });
  describe("design B", () => {
    const b = { due: "2026-11-16", to: { name: "Sam Rivera", company: "", email: "" }, project: "Test", caption: "Editorial", note: ["a", "b", "c"], depositNote: "", photo: `invoice-photo:${"0".repeat(32)}`, crop: { x: 2, y: -1, z: 9 }, tone: "x" };
    const one = (n: number) => Array.from({ length: n }, (_, i) => ({ desc: `L${i}`, sub: ` s${i} `, qty: 1, rate: 100 }));
    it("keeps subs, clamps the framing, defaults the tone", () => {
      const got = cleanInvoice({ date: "2026-11-09", lines: one(1), paid: 0, b });
      expect(got).toMatchObject({ lines: [{ desc: "L0", sub: "s0" }], b: { crop: { x: 1, y: 0, z: 3 }, tone: "dark" } });
    });
    it("counts the deposit as a row, and needs a photo and a name", () => {
      expect(cleanInvoice({ date: "2026-11-09", lines: one(MAX_ROWS_B), paid: 0, b })).not.toHaveProperty("error");
      expect(cleanInvoice({ date: "2026-11-09", lines: one(MAX_ROWS_B), paid: 100, b })).toHaveProperty("error");
      expect(cleanInvoice({ date: "2026-11-09", lines: one(1), b: { ...b, photo: "invoice-photo:../x" } })).toHaveProperty("error");
      expect(cleanInvoice({ date: "2026-11-09", lines: one(1), b: { ...b, to: { name: " " } } })).toHaveProperty("error");
    });
    it("writes money and days as the page does", () => {
      expect([usdB(1500), usdB(1500.5), usdB(-100)]).toEqual(["$1,500", "$1,500.50", "-$100"]);
      expect([dayB("2026-11-09"), dayB("2026-11-16", true)]).toEqual(["9 Nov", "16 Nov 2026"]);
    });
  });
});
