"use server";

import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  COOLDOWN_MS,
  DAILY_CAP,
  MAX,
  SHOOT_TYPES,
  cooldown,
  cooldownKey,
  dayKey,
  enquiry,
  enquiryKey,
  problems,
  summary,
  waitPhrase,
} from "@/lib/inbox";

/**
 * Handles a contact submission.
 *
 * The one rule here is that an enquiry must never disappear quietly. A form
 * that accepts a message and drops it is worse than no form at all — the
 * sender believes they have been in touch and waits. So:
 *
 *   - Validation happens on the server, not only in the browser.
 *   - The enquiry is written to the inbox /admin reads, which is the delivery
 *     path: no mail provider, no account, and nothing for the sender to do
 *     afterwards.
 *   - If that write cannot happen — no binding in development, or the daily
 *     ceiling reached — the action says so plainly and hands back a `mailto:`
 *     the visitor can send themselves, instead of pretending it worked.
 *
 * Mail is not sent from here at all any more. It was never configured, and
 * the branch that would have done it is gone rather than left as a switch
 * nobody will find: an enquiry that is *stored* cannot bounce, cannot land in
 * spam, and does not need a sending domain, an API key or a monthly bill. If
 * a notification to his phone is wanted later, it belongs beside this write
 * and not instead of it.
 */

export type ContactState = {
  status: "idle" | "sent" | "error" | "unconfigured";
  message?: string;
  /** Set when delivery is not possible, so the UI can offer a real path. */
  mailto?: string;
  /** Field name → problem, for inline errors. */
  errors?: Record<string, string>;
  /** Echoed back so a failed submit does not wipe what they typed. */
  values?: Record<string, string>;
};

const TO = "hello@juliangigola.com";

/**
 * A sender's identity for the cooldown, as a hash.
 *
 * Never the address itself: an IP is personal data, and "has this sender just
 * written?" is answered exactly as well by a hash. Salted with the day so the
 * keys cannot be matched against tomorrow's and fall out of use on their own.
 *
 * Falls back to the user agent where Cloudflare gives no address, which is
 * only ever development — a shared bucket there is the right failure, since
 * the alternative is no cooldown at all.
 */
async function senderHash(headers: Headers, day: string): Promise<string> {
  const ip =
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("user-agent") ??
    "unknown";
  const bytes = new TextEncoder().encode(`${day}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function submitEnquiry(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const read = (key: string) => String(formData.get(key) ?? "").trim();

  /* The honeypot.
   *
   * A field no person can see or tab to, so anything in it was put there by
   * something filling every input on the page. Answered with the same success
   * the form gives a real enquiry — telling a bot it was caught is telling
   * whoever wrote it what to change — and nothing is stored, so the inbox
   * stays clean and the write quota is not spent on it.
   */
  if (read("company") !== "") {
    return {
      status: "sent",
      message: "Thank you, we will get back to you shortly! :)",
    };
  }

  const values = {
    type: read("type"),
    name: read("name"),
    email: read("email"),
    detail: read("detail"),
    message: read("message"),
  };

  const errors = problems(values);
  if (Object.keys(errors).length) {
    return {
      status: "error",
      errors,
      values,
      message: "Please check the fields marked below.",
    };
  }

  const type = (SHOOT_TYPES as readonly string[]).includes(values.type)
    ? values.type
    : "other";

  /** The hand-written route, for every path that cannot store the enquiry. */
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
  const mailto = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  try {
    const { env, cf } = await getCloudflareContext({ async: true });
    const inbox = env.INBOX;

    if (!inbox) {
      // No binding: `next dev` without the Cloudflare context, or a preview
      // built before the namespace existed. The form still behaves, and says
      // why.
      return {
        status: "unconfigured",
        values,
        message:
          "This build has no inbox attached, so nothing was stored. Your message is ready below — open it and it will reach Julian directly.",
        mailto,
      };
    }

    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const hash = await senderHash(await headers(), day);

    /* The cooldown. One enquiry per sender every five minutes.
     *
     * Read before anything is written, so a sender inside the window costs a
     * single read and no writes at all — which is the point of the ceiling
     * below it: whatever gets through the cooldown is what the quota has to
     * survive. */
    const wrote = await inbox.get(cooldownKey(hash));
    const gate = cooldown(wrote ? Number(wrote) : null, now);
    if (!gate.ok) {
      return {
        status: "error",
        values,
        message: `That has been sent. If you have something to add, you can write again in ${waitPhrase(gate.waitSeconds)} — or reply to the email link below any time.`,
        mailto,
      };
    }

    /* The ceiling. The cooldown is per sender and a spammer has more than one
     * address; this is what stands behind it. Counted rather than measured
     * because KV cannot be asked how many keys it holds without listing them
     * all, which is the expensive thing being avoided. */
    const today = Number((await inbox.get(dayKey(now))) ?? 0);
    if (today >= DAILY_CAP) {
      return {
        status: "unconfigured",
        values,
        message:
          "The form has taken an unusual number of messages today and has stopped accepting more. Nothing is lost — use the email link below and it will reach him directly.",
        mailto,
      };
    }

    const id = crypto.randomUUID();
    const country = typeof cf?.country === "string" ? cf.country : undefined;

    const stored = enquiry(values, now, id, country);
    // The summary rides along as metadata so /admin can draw the whole inbox
    // from one request. See the note in `lib/inbox.ts`.
    await inbox.put(enquiryKey(now, id.slice(0, 8)), JSON.stringify(stored), {
      metadata: summary(stored),
    });
    // The cooldown expires itself, so nothing has to clean it up. The counter
    // is given two days so a message near midnight cannot be double-counted
    // against a bucket that has already gone.
    await inbox.put(cooldownKey(hash), String(now), {
      expirationTtl: Math.ceil(COOLDOWN_MS / 1000),
    });
    await inbox.put(dayKey(now), String(today + 1), {
      expirationTtl: 2 * 24 * 60 * 60,
    });

    return {
      status: "sent",
      message: "Thank you, we will get back to you shortly! :)",
    };
  } catch (err) {
    // Never swallow this: hand back a route that definitely works.
    console.error("contact: could not store the enquiry", err);
    return {
      status: "unconfigured",
      values,
      message:
        "Something went wrong storing that. Nothing was lost — use the email link below and it will reach him directly.",
      mailto,
    };
  }
}
