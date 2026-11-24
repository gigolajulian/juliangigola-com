import { describe, expect, it, vi } from "vitest";
import { alertHello } from "@/lib/email/hello-mail";
import { FakeEmail } from "../../backend/fakes";

/* `lib/email/hello-mail.ts`: mail to hello@. True once sent; a mail too big with
   its pictures goes again without them. */

const pic = { content: new ArrayBuffer(4), filename: "ref.jpg", type: "image/jpeg", disposition: "attachment" as const };

describe("alertHello", () => {
  it("is false with no email binding", async () => expect(await alertHello(undefined, "Deposit: Ana", ["a"])).toBe(false));

  it("mails hello@ with the lines, the Inbox link and the reply-to", async () => {
    const mail = new FakeEmail();
    expect(await alertHello(mail as never, "Deposit: Ana", ["Paid $200"], { name: "Ana", email: "ana@example.com" })).toBe(true);
    const sent = mail.sent[0];
    expect(sent.to).toBe("hello@juliangigola.com");
    expect(sent.text).toBe("Paid $200\n\nInbox: https://juliangigola.com/admin");
    expect(sent.replyTo).toEqual({ name: "Ana", email: "ana@example.com" });
    expect("attachments" in sent).toBe(false);
  });

  it("sends again without the pictures when the first send fails", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn().mockRejectedValueOnce(new Error("too large")).mockResolvedValueOnce(undefined);
    expect(await alertHello({ send } as never, "Inquiry: Bo", ["hi"], undefined, [pic])).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    const second = send.mock.calls[1][0];
    expect(second.attachments).toBeUndefined();
    expect(second.text).toContain("1 reference image(s) were too large to attach.");
    err.mockRestore();
  });

  it("is false when the send fails with nothing to drop", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const mail = new FakeEmail();
    mail.broken = true;
    expect(await alertHello(mail as never, "Proof: Cy", ["x"])).toBe(false);
    expect(err).toHaveBeenCalledWith("hello mail", "Proof", expect.any(String));
    err.mockRestore();
  });
});
