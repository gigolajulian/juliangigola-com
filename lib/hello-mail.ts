/* Mail to hello@ from the site: deposits, proofs, booking changes. */
const MAIL_TO = "hello@juliangigola.com";
const MAIL_FROM = "enquiries@notifications.juliangigola.com";

// Bytes, never a base64 string: `send()` mails a string as-is, so the picture arrives as text.
export type Attachment = { content: ArrayBuffer; filename: string; type: string; disposition: "attachment" };


/** True once hello@ has it. */
export async function mail(email: CloudflareEnv["EMAIL"] | undefined, subject: string, lines: string[], who?: { name: string; email: string }, attachments: Attachment[] = []): Promise<boolean> {
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
    console.error("hello mail", subject.split(":")[0], String(e));
    // Images can push a mail past the size limit: the mail matters more, so it goes again without them.
    if (attachments.length) return mail(email, subject, [...lines, "", `${attachments.length} reference image(s) were too large to attach. Ask the client to email them.`], who);
    return false;
  }
}
