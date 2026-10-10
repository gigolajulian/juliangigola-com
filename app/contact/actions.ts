"use server";

import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import imageLoader from "@/image-loader";
import LOOKS from "@/lib/picker-looks.json";
import {
  COOLDOWN_MS,
  DAILY_CAP,
  MAX,
  SHOOT_TYPES,
  cooldown,
  cooldownKey,
  dayKey,
  emailCopy,
  enquiry,
  enquiryKey,
  problems,
  summary,
  waitPhrase,
  MAX_REFS,
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
/** The sending subdomain onboarded to Cloudflare Email Sending. See wrangler.jsonc. */
const FROM = "enquiries@notifications.juliangigola.com";

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
      message: "Thanks. I'll reply within 24 hours.",
    };
  }

  const values = {
    type: read("type"),
    name: read("name"),
    email: read("email"),
    // A booking's session chip, ahead of its date and place.
    detail: [read("session"), read("detail")].filter(Boolean).join(" · "),
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
  const subject = `${type} inquiry from ${values.name}`;
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
          "This build has no inbox attached, so nothing was stored. Your message is ready below. Open it and it will reach me directly.",
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
        message: `That has been sent. If you have something to add, you can write again in ${waitPhrase(gate.waitSeconds)}, or reply to the email link below any time.`,
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
          "The form has taken an unusual number of messages today and has stopped accepting more. Nothing is lost. Use the email link below and it will reach me directly.",
        mailto,
      };
    }

    const id = crypto.randomUUID();
    const country = typeof cf?.country === "string" ? cf.country : undefined;

    /* References (`components/reference-picks.tsx`): Julian's frames by
       path, and the visitor's own images, already shrunk in their browser.
       Checked here all the same: paths of the site's shape only, images
       only, and a ceiling on count and size. */
    const picks = String(formData.get("picks") ?? "")
      .split("\n")
      .filter((src) => /^\/work\/[\w-]+\/[\w.-]+\.(jpe?g|png|webp)$/i.test(src))
      .slice(0, MAX_REFS);
    let budget = 20 * 1024 * 1024;
    const uploads = formData
      .getAll("refs")
      .filter((f): f is File => f instanceof File && f.size > 0 && f.type.startsWith("image/"))
      .slice(0, MAX_REFS - picks.length)
      .filter((f) => f.size <= 6 * 1024 * 1024 && (budget -= f.size) >= 0);

    const stored = {
      ...enquiry(values, now, id, country),
      ...(picks.length ? { picks } : {}),
      ...(uploads.length ? { files: uploads.map((f) => f.name.slice(0, 80)) } : {}),
    };
    // The summary rides along as metadata so /admin can draw the whole inbox
    // from one request. See the note in `lib/inbox.ts`.
    const key = enquiryKey(now, id.slice(0, 8));
    await inbox.put(key, JSON.stringify(stored), {
      metadata: summary(stored),
    });
    /* Their images beside it, for /admin's Inbox (`ref:<key>:<n>`, read
       and deleted with the message by `app/api/inbox/route.ts`). Best
       effort like the email: the enquiry is already stored. */
    try {
      await Promise.all(
        uploads.map(async (f, n) =>
          inbox.put(`ref:${key}:${n}`, await f.arrayBuffer(), {
            metadata: { type: f.type },
          }),
        ),
      );
    } catch (err) {
      console.error("contact: stored the enquiry but not its images", err);
    }
    // The cooldown expires itself, so nothing has to clean it up. The counter
    // is given two days so a message near midnight cannot be double-counted
    // against a bucket that has already gone.
    await inbox.put(cooldownKey(hash), String(now), {
      expirationTtl: Math.ceil(COOLDOWN_MS / 1000),
    });
    await inbox.put(dayKey(now), String(today + 1), {
      expirationTtl: 2 * 24 * 60 * 60,
    });

    /* A copy to Julian's mail, so an enquiry reaches him where he already
       looks. Strictly after the store and strictly best-effort: the stored
       copy is the record, and a mail failure — the destination not yet
       verified, a quota, an outage — must never turn a sent enquiry into an
       error for the person who sent it. Logged so it shows in the Worker's
       observability, not surfaced. `replyTo` is the enquirer, so a plain
       reply in Gmail answers them. No binding in `next dev`; the optional
       chain covers it. */
    try {
      const inline = await pickAttachments(picks, env.ASSETS);
      const { subject, text, html } = emailCopy(
        stored,
        LOOKS,
        inline.map((a) => a.src),
      );
      /* `to` although the binding already fixes the destination: the docs
         call it optional there, and the runtime threw "Email must have at
         least one recipient" on every enquiry until it was set. */
      await env.EMAIL?.send({
        to: TO,
        from: { name: "Julian Gigola website", email: FROM },
        subject,
        text,
        html,
        replyTo: { name: stored.name, email: stored.email },
        attachments: [
          ...(await Promise.all(
            uploads.map(async (f) => ({
              content: Buffer.from(await f.arrayBuffer()).toString("base64"),
              filename: f.name.slice(0, 80),
              type: f.type,
              disposition: "attachment" as const,
            })),
          )),
          ...inline.map((a) => a.file),
        ],
      });
    } catch (err) {
      console.error(
        "contact: stored the enquiry but could not mail a copy",
        err,
      );
    }

    return {
      status: "sent",
      message: "Thanks. I'll reply within 24 hours.",
    };
  } catch (err) {
    // Never swallow this: hand back a route that definitely works.
    console.error("contact: could not store the enquiry", err);
    return {
      status: "unconfigured",
      values,
      message:
        "Something went wrong storing that. Nothing was lost. Use the email link below and it will reach me directly.",
      mailto,
    };
  }
}

/* The frames they picked from the work, attached and shown under their
   links. One that will not fetch is left out, not fatal: its link is
   still in the text.

   Not through the site's own `/cdn-cgi/image/` address: asked from inside
   the Worker it never answers, so nothing was attached. The file is read from the static assets instead, the 1080px
   copy where there is one so the mail stays small, or resized with
   `cf.image` (the Workers way) when the archive is on R2. */
async function pickAttachments(picks: string[], assets?: { fetch: typeof fetch }) {
  const got = await Promise.all(
    picks.map(async (src, i) => {
      try {
        const sized = imageLoader({ src, width: 1080, quality: 82 });
        const path = sized.replace(/^\/cdn-cgi\/image\/[^/]+\//, "");
        const signal = AbortSignal.timeout(8000);
        const res = /^https?:/.test(path)
          ? await fetch(path, {
              signal,
              cf: { image: { width: 1600, quality: 82 } },
            } as RequestInit)
          : await assets?.fetch(
              new URL(path.replace(/^\/?/, "/"), "https://juliangigola.com"),
              { signal },
            );
        if (!res?.ok) {
          console.error("contact: pick not attached", src, res?.status);
          return null;
        }
        return {
          src,
          file: {
            content: Buffer.from(await res.arrayBuffer()).toString("base64"),
            filename: src.split("/").slice(-2).join("-"),
            type: res.headers.get("content-type") ?? "image/jpeg",
            disposition: "inline" as const,
            contentId: `pick-${i}`,
          },
        };
      } catch (err) {
        console.error("contact: pick not attached", src, err);
        return null;
      }
    }),
  );
  return got.filter((a) => a !== null);
}
