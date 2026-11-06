import { describe, expect, it } from "vitest";
import { AMOUNT } from "./deposit";
import { balance, cleanInvoice, DEPOSIT, invoiceNo, mmyy } from "./invoice";

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
});
