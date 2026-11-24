/* Mail to hello@ that also lands on the lead's log. Here, not in lib/email, so the mail modules import nothing from leads. */
import { alertHello, type Attachment } from "@/lib/email/hello-mail";
import { logMail, type LeadStore } from "@/lib/leads/lead-store";

/** `alertHello`, then the mail on the lead's log once hello@ has it. `who` is the client it is about, `log` the line's kind and booking. */
export async function alertAndLog(
  env: LeadStore & { EMAIL?: CloudflareEnv["EMAIL"] },
  subject: string,
  lines: string[],
  { who, log, attachments }: { who?: { name: string; email: string }; log: { kind: string; booking: string }; attachments?: Attachment[] },
) {
  if (await alertHello(env.EMAIL, subject, lines, { who, attachments })) await logMail(env, who?.email, subject, { to: "hello@", ...log });
}
