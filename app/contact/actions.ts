"use server";

/**
 * Handles a contact submission.
 *
 * The one rule here is that an enquiry must never disappear quietly. A form
 * that accepts a message and drops it is worse than no form at all — the
 * sender believes they have been in touch and waits. So:
 *
 *   - Validation happens on the server, not only in the browser.
 *   - If no mail provider is configured, the action says so plainly and hands
 *     back a `mailto:` the visitor can send themselves, instead of pretending
 *     it worked.
 *
 * Wiring up delivery: set `RESEND_API_KEY` and `CONTACT_TO` in `.env.local`.
 * Nothing else needs to change.
 */

export type ContactState = {
  status: "idle" | "sent" | "error" | "unconfigured";
  message?: string;
  /** Set when delivery is not configured, so the UI can offer a real path. */
  mailto?: string;
  /** Field name → problem, for inline errors. */
  errors?: Record<string, string>;
  /** Echoed back so a failed submit does not wipe what they typed. */
  values?: Record<string, string>;
};

const SHOOT_TYPES = [
  "editorial",
  "campaign",
  "music",
  "session",
  "other",
] as const;

const MAX = { name: 100, email: 200, detail: 200, message: 5000 } as const;

/** Deliberately loose — the only thing worth rejecting is what cannot be a address. */
const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

export async function submitEnquiry(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const read = (key: string) => String(formData.get(key) ?? "").trim();

  const values = {
    type: read("type"),
    name: read("name"),
    email: read("email"),
    detail: read("detail"),
    message: read("message"),
  };

  const errors: Record<string, string> = {};

  if (!values.name) errors.name = "Please add your name.";
  else if (values.name.length > MAX.name)
    errors.name = "That is longer than we can send.";

  if (!values.email) errors.email = "Please add an email so Julian can reply.";
  else if (!looksLikeEmail(values.email))
    errors.email = "That does not look like an email address.";
  else if (values.email.length > MAX.email)
    errors.email = "That is longer than we can send.";

  if (!values.message)
    errors.message = "Please say a little about the project.";
  else if (values.message.length > MAX.message)
    errors.message = "Please trim this a little.";

  const type = (SHOOT_TYPES as readonly string[]).includes(values.type)
    ? values.type
    : "other";

  if (Object.keys(errors).length) {
    return {
      status: "error",
      errors,
      values,
      message: "Please check the fields marked below.",
    };
  }

  const subject = `${type} enquiry — ${values.name}`;
  const body = [
    `Type: ${type}`,
    values.detail ? `Details: ${values.detail.slice(0, MAX.detail)}` : null,
    `From: ${values.name} <${values.email}>`,
    "",
    values.message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO ?? "hello@juliangigola.com";

  if (!apiKey) {
    return {
      status: "unconfigured",
      values,
      message:
        "The form is not connected to a mail provider yet, so nothing was sent. Use the email link below and your message will come through as normal.",
      mailto: `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Site enquiries <forms@juliangigola.com>`,
        to: [to],
        // So a reply in the mail client goes to the sender, not to the site.
        reply_to: values.email,
        subject,
        text: body,
      }),
    });

    if (!res.ok) throw new Error(`provider responded ${res.status}`);

    return {
      status: "sent",
      message: "Thank you — Julian will come back to you shortly.",
    };
  } catch (err) {
    // Never swallow this: hand back a route that definitely works.
    console.error("contact: delivery failed", err);
    return {
      status: "unconfigured",
      values,
      message:
        "Something went wrong sending that. Nothing was lost — use the email link below and it will reach him directly.",
      mailto: `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    };
  }
}
