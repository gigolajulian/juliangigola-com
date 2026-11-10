import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanFrom, type Invoice } from "@/lib/invoice";
import { fileName, invoicePdf, type InvoiceDoc } from "@/lib/invoice-pdf";
import { COL, place } from "@/lib/invoice-photo";

/* The invoice PDF's name and bytes, and design B's photo placement. The
   faces it fetches come from public/ through a stubbed fetch. */

const inv: Invoice = { no: "1126", date: "2026-11-06", lines: [{ desc: "Portrait session", qty: 1, rate: 450 }], paid: 100, at: "" };
const doc = (over: Partial<InvoiceDoc> = {}): InvoiceDoc => ({
  from: cleanFrom({ name: "Julian Gigola", email: "hello@juliangigola.com" }),
  to: { name: "Kai / Lin: Co" },
  inv,
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe("fileName", () => {
  it("is the number and the client, without characters a file name cannot hold", () => {
    expect(fileName(doc())).toBe("INVOICE 1126 - Kai  Lin Co.pdf");
  });
  it("uses design B's company, upper case, falling back to the name", () => {
    const b = { to: { name: "Kai", company: "Acme", email: "" } } as Invoice["b"];
    expect(fileName(doc({ inv: { ...inv, b } }))).toBe("INVOICE 1126 - ACME.pdf");
    expect(fileName(doc({ inv: { ...inv, b: { ...b!, to: { name: "Kai", company: "", email: "" } } } }))).toBe("INVOICE 1126 - KAI.pdf");
  });
});

describe("invoicePdf", () => {
  // First: the faces are cached once loaded, and a failed load is not.
  it("fails clearly when a face cannot be fetched", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));
    await expect(invoicePdf(doc())).rejects.toThrow(/Could not load/);
  });
  it("writes a one-page PDF named for the invoice, retrying the faces", async () => {
    vi.stubGlobal("fetch", async (url: string) => new Response(await readFile(join(process.cwd(), "public", url))));
    const file = await invoicePdf(doc());
    expect(file.name).toBe("INVOICE 1126 - Kai  Lin Co.pdf");
    expect(file.type).toBe("application/pdf");
    const text = new TextDecoder("latin1").decode(await file.arrayBuffer());
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Pages /Count 1");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });
});

describe("place", () => {
  it("covers the box, centred at 0.5", () => {
    const p = place(2000, 1000, 100, 200, { x: 0.5, y: 0.5, z: 1 });
    expect(p).toEqual({ w: 400, h: 200, left: -150, top: -0 });
  });
  it("slides like object-position and zooms past cover", () => {
    expect(place(2000, 1000, 100, 200, { x: 0, y: 0, z: 1 }).left).toBe(-0);
    expect(place(2000, 1000, 100, 200, { x: 1, y: 0, z: 1 }).left).toBe(-300);
    const z = place(1000, 1000, 100, 100, { x: 0.5, y: 0.5, z: 2 });
    expect([z.w, z.left, z.top]).toEqual([200, -50, -50]);
  });
  it("frames the column at 41% of A4", () => {
    expect(COL.w).toBeCloseTo(243.93, 2);
  });
});
