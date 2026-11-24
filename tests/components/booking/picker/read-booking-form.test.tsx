import { describe, expect, it } from "vitest";
import { readBookingForm } from "@/components/booking/picker/use-picker";
import { shortDuration } from "@/components/booking/picker/editorial";
import { duration } from "@/lib/booking/rules";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

/* The booking form as `book` reads it (`use-picker.tsx`), both looks. */
describe("readBookingForm", () => {
  it("reads the editorial card: first and last, a call's kind, a location with its question", () => {
    const f = readBookingForm(form({ first: " Ana ", last: "Lee ", email: " ana@example.com", phone: "(408) 555 0134", via: "Phone", opt: "Outdoor", detail: " Alum Rock ", notes: " hi " }), "portraits");
    expect(f).toMatchObject({ name: "Ana Lee", firstName: "Ana", email: " ana@example.com", phone: "+14085550134", phoneRaw: "(408) 555 0134", via: "Phone", where: "Outdoor: Alum Rock", notes: "hi", refs: null });
    expect(f.typed.first).toBe(" Ana ");
  });

  it("reads the stepper: one Name, an optional phone, the one place an event has, and its picks", () => {
    const f = readBookingForm(form({ name: "Ana Maria Lee", email: "ana@example.com", phone: "", picks: "a,b" }), "digitals");
    expect(f).toMatchObject({ name: "Ana Maria Lee", firstName: "Ana", phone: "", phoneRaw: "", via: "", where: "Studio" });
    expect(f.refs?.get("picks")).toBe("a,b");
  });

  it("takes a typed place where the event lists none", () => {
    expect(readBookingForm(form({ name: "Ana", where: " The pier " }), "call").where).toBe("The pier");
  });
});

describe("shortDuration", () => {
  it("is the card's short length, apart from the rules' long one", () => {
    expect([45, 60, 90].map(shortDuration)).toEqual(["45 min", "1 hr", "1 hr 30 min"]);
    expect(duration(120)).toBe("2 hours");
  });
});
