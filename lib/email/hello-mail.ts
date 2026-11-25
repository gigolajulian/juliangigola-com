/* Mail to hello@ from the site: deposits, proofs, booking changes. */

const MAIL_TO = "hello@juliangigola.com";
const MAIL_FROM = "enquiries@notifications.juliangigola.com";

// Bytes, never a base64 string: `send()` mails a string as-is, so the picture arrives as text.
export type Attachment = { content: ArrayBuffer; filename: string; type: string; disposition: "attachment" };

/** True once hello@ has it. `who`, the client it is about, is the reply-to. */
export async function alertHello(
  email: CloudflareEnv["EMAIL"] | undefined,
  subject: string,
  lines: string[],
  { who, attachments = [] }: { who?: { name: string; email: string }; attachments?: Attachment[] } = {},
): Promise<boolean> {
  if (!email) return false;
  try {
    await email.send({
      to: MAIL_TO,
      from: { name: "Julian Gigola website", email: MAIL_FROM },
      subject,
      text: [...lines, "", "Inbox: https://juliangigola.com/admin"].join("\n"),
      ...(who?.email ? { replyTo: who } : {}),
      ...(attachments.length ? { attachments } : {}),
    });
    return true;
  } catch (e) {
    // The error only: its heading can name the client.
    console.error("hello mail", String(e));
    // Images can push a mail past the size limit: the mail matters more, so it goes again without them.
    if (attachments.length)
      return alertHello(
        email,
        subject,
        [...lines, "", `${attachments.length} reference image(s) were too large to attach. Ask the client to email them.`],
        { who },
      );
    return false;
  }
}
