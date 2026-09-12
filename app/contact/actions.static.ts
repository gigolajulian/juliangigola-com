/**
 * Static-export stand-in for `actions.ts`.
 *
 * A static host has no server, so the real Server Action cannot run there —
 * and `output: "export"` refuses to build at all while a `"use server"`
 * module is in the graph. The GitHub Pages workflow copies this file over
 * `actions.ts` before building; nothing else in the app changes.
 *
 * Note there is no `"use server"` here. It is an ordinary async function, and
 * `useActionState` drives a client function just as happily as a server one —
 * so the form keeps its validation, its inline field errors, and its pending
 * state. What it cannot do is deliver mail, so it always returns the
 * `unconfigured` branch the form already knows how to render: a plain
 * explanation plus a prefilled `mailto:` that actually works.
 *
 * The result is a form that behaves correctly rather than one that silently
 * swallows an enquiry, which is the one outcome worth avoiding.
 */

export type ContactState = {
  status: "idle" | "sent" | "error" | "unconfigured";
  message?: string;
  mailto?: string;
  errors?: Record<string, string>;
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
const TO = "hello@juliangigola.com";

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

  return {
    status: "unconfigured",
    values,
    message:
      "This is a static preview, so the form cannot send on its own. Your message is ready below — open it and it will reach Julian directly.",
    mailto: `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}
