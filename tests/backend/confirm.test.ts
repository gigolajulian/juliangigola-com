import { describe, expect, it } from "vitest";
import { FakeEmail } from "./fakes";
import { cancelledSubject, confirmMail, sendCancelled, sendConfirm, when, type Confirm } from "@/lib/booking/confirm";
import { SIG_DARK, SIG_HTML, SIG_TEXT } from "@/lib/email/email-signature";

/* The client's "You're in." mail and the cancel note (`lib/booking/confirm.ts`),
   signed with Julian's one signature (`lib/email/email-signature.ts`). */

const base: Confirm = {
  name: "Ana Lee",
  email: "ana@example.com",
  session: "Portraits",
  start: "2026-11-21T18:00:00Z",
  end: "2026-11-21T19:00:00Z",
  uid: "abcdef1234567890",
  manage: { reschedule: "https://juliangigola.com/booking/t?do=reschedule", cancel: "https://juliangigola.com/booking/t?do=cancel" },
};

describe("when", () => {
  it("writes Julian's time with the range spelled out", () => {
    expect(when(base.start, base.end)).toBe("Sat, Nov 21, 10:00 to 11:00 AM PST");
    expect(when(base.start)).toBe("Sat, Nov 21, 10:00 AM PST");
  });
});

describe("confirmMail", () => {
  it("subjects and leads a booking, with the length and a short booking ref", () => {
    const m = confirmMail(base);
    expect(m.subject).toBe("Booked: Portraits, Sat, Nov 21, 10:00 to 11:00 AM PST");
    expect(m.text).toContain("You're in.");
    expect(m.text).toContain("Thanks, Ana.");
    expect(m.text).toContain("When: Sat, Nov 21, 10:00 to 11:00 AM PST, 60 minutes");
    expect(m.text).toContain("Booking: abcdef12");
    expect(m.text).toContain("https://juliangigola.com/booking/t?do=reschedule");
    expect(m.attachments.map((a) => a.contentId)).toEqual(["name-w", "name-ink"]);
  });

  it("escapes what the client typed", () => {
    const m = confirmMail({ ...base, where: "<script>x</script>" });
    expect(m.html).not.toContain("<script>x");
    expect(m.html).toContain("&#60;script&#62;");
  });

  it("leaves the links out while the site's own have no secret", () => {
    const m = confirmMail({ ...base, manage: null });
    expect(m.text).not.toContain("Reschedule:");
    expect(m.html).not.toContain(">Reschedule<");
  });

  it("writes the reminder and the deposit receipt", () => {
    const m = confirmMail({ ...base, kind: "reminder", deposit: { ref: "pi_1234567890abc", at: "2026-11-01T18:00:00Z", card: "Visa 4242" } });
    expect(m.subject).toBe("Tomorrow: Portraits, 10:00 AM");
    expect(m.text).toContain("See you tomorrow.");
    expect(m.text).toContain("Ref: pi_12345678");
    expect(m.text).toContain("under 48 hours now");
  });

  it("carries Julian's signature in both parts and its dark rules", () => {
    const m = confirmMail(base);
    expect(m.html).toContain(SIG_HTML);
    expect(m.html).toContain(SIG_DARK);
    expect(m.text.endsWith(SIG_TEXT)).toBe(true);
    expect(SIG_TEXT).toContain("hello@juliangigola.com");
  });
});

describe("sendConfirm", () => {
  it("sends nothing without a mailer or an address", async () => {
    expect(await sendConfirm(undefined, base)).toBe(false);
    expect(await sendConfirm(new FakeEmail() as never, { ...base, email: "" })).toBe(false);
  });

  it("sends from book@ to the client", async () => {
    const mail = new FakeEmail();
    expect(await sendConfirm(mail as never, base)).toBe(true);
    expect(mail.sent[0]).toMatchObject({ to: { email: "ana@example.com" }, from: { email: "book@juliangigola.com" }, replyTo: "hello@juliangigola.com" });
  });

  it("retries without the inline logo, linking it instead", async () => {
    const sent: Record<string, unknown>[] = [];
    const mailer = {
      send: async (m: Record<string, unknown>) => {
        if (m.attachments) throw new Error("inline parts refused");
        sent.push(m);
      },
    };
    expect(await sendConfirm(mailer as never, base)).toBe(true);
    expect(sent[0].html).toContain("https://juliangigola.com/email-name-w.png");
    expect(sent[0].html).not.toContain("cid:name-w");
  });

  it("answers false when the mail cannot go at all", async () => {
    const mail = new FakeEmail();
    mail.broken = true;
    expect(await sendConfirm(mail as never, base)).toBe(false);
  });
});

describe("sendCancelled", () => {
  it("says what happened to the deposit", async () => {
    const mail = new FakeEmail();
    expect(await sendCancelled(mail as never, base, "kept")).toBe(true);
    expect(mail.sent[0].subject).toBe(cancelledSubject(base));
    expect(mail.sent[0].text).toContain("Hi Ana,");
    expect(mail.sent[0].text).toContain("is not refunded");
  });

  it("leaves no empty line pairs when there is no deposit", async () => {
    const mail = new FakeEmail();
    await sendCancelled(mail as never, base, "none");
    expect(mail.sent[0].text).not.toMatch(/\n\n\n/);
  });
});
