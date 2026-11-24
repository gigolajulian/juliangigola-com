import { submitEnquiry } from "@/lib/leads/enquiry-action";
import type { ContactState } from "@/lib/inbox";

export const INITIAL: ContactState = { status: "idle" };

/* The request itself failing (offline, a dropped connection, the Worker
   erroring) threw out of the action and took the whole page to its error
   screen, the brief gone with it. Caught here instead: the fields come
   back as typed, and the mail app is offered, as when nothing could be
   stored (`lib/leads/enquiry-action.ts`). */
export async function submitOrKeep(prev: ContactState, data: FormData): Promise<ContactState> {
  try {
    return await submitEnquiry(prev, data);
  } catch {
    const read = (key: string) => String(data.get(key) ?? "").trim();
    const values = {
      type: read("type"),
      name: read("name"),
      email: read("email"),
      detail: [read("session"), read("detail")].filter(Boolean).join(" · "),
      message: read("message"),
    };
    const body = [
      values.type ? `Type: ${values.type}` : null,
      values.detail ? `Details: ${values.detail}` : null,
      `From: ${values.name} <${values.email}>`,
      "",
      values.message,
    ]
      .filter((line) => line !== null)
      .join("\n");
    return {
      status: "error",
      values,
      message:
        "That didn't go through, so nothing was sent. Your message is still here. Try again, or open it in your mail app and it will reach me directly.",
      mailto: `mailto:contact@juliangigola.com?subject=${encodeURIComponent(`${values.type || "other"} inquiry from ${values.name}`)}&body=${encodeURIComponent(body)}`,
    };
  }
}
