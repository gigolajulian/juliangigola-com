/* ── the inbox ────────────────────────────────────────────────────
 * Where an enquiry goes now that the form can deliver it.
 *
 * Until now the contact form had no destination. With no mail provider
 * configured it took its `unconfigured` branch: a polite explanation and a
 * prefilled `mailto:`, which the visitor then had to open and send themselves.
 * That is honest — it never swallowed a message — but it asks the one person
 * you want to hear from to do the work, on a device whose mail client may not
 * be set up at all. Every enquiry was a second action away from being lost.
 *
 * So the Worker keeps them. A KV namespace, one entry per enquiry, read back
 * by /admin. Not a database because there is nothing relational here — an
 * enquiry is written once, read a few times, and deleted — and KV is the one
 * store this site can reach for nothing.
 *
 * This module is the part with no Cloudflare in it: keys, validation and the
 * cooldown arithmetic, so `scripts/check-inbox.mjs` can run the real
 * functions. The binding itself is touched in `app/contact/actions.ts` and
 * `app/api/inbox/route.ts`, which are thin on purpose.
 * ─────────────────────────────────────────────────────────────── */

/** What one enquiry looks like once it is stored. */
export type Enquiry = {
  id: string;
  /** ISO 8601, UTC. When the Worker received it. */
  at: string;
  type: string;
  name: string;
  email: string;
  /** The free-text "when / where / what" field. Optional on the form. */
  detail: string;
  message: string;
  /** Whether it has been read in /admin. */
  read: boolean;
  /** Two-letter country from Cloudflare, where it was given. Never the IP. */
  country?: string;
};

/**
 * The cooldown, in milliseconds.
 *
 * Julian asked for five minutes, which is also about the right number: nobody
 * sends two genuine enquiries inside five minutes, and anything automated
 * hits a wall immediately rather than getting a few hundred through before a
 * daily cap notices.
 */
export const COOLDOWN_MS = 5 * 60 * 1000;

/**
 * How many enquiries may be stored in a day, across everybody.
 *
 * The cooldown is per sender and a spammer has more than one address, so it
 * needs a ceiling behind it. This one is set by what the free plan gives
 * rather than by what a photographer receives: KV allows a thousand writes a
 * day, and each enquiry costs two of them (the entry and the sender's
 * cooldown). Two hundred is generous for the real traffic — he has never had
 * two hundred enquiries in a year — and leaves the quota well clear.
 *
 * Past it the form says the inbox is full and offers the mailto, which is the
 * old behaviour: refusing to accept a message is fine, pretending to accept
 * one is not.
 */
export const DAILY_CAP = 200;

/* ── keys ─────────────────────────────────────────────────────────
 * KV lists keys in lexicographic order, so the timestamp goes in front and
 * the whole inbox comes back sorted with no work at the reading end. Padded
 * to a fixed width for the same reason — `Date.now()` is 13 digits until the
 * year 2286, and a shorter number would sort above a longer one.
 * ─────────────────────────────────────────────────────────────── */

/** `msg:<ms since epoch, padded>:<random>` — sorts oldest first. */
export const enquiryKey = (at: number, nonce: string): string =>
  `msg:${String(at).padStart(15, "0")}:${nonce}`;

/** The day bucket a timestamp belongs to, for the daily cap. */
export const dayKey = (at: number): string =>
  `count:${new Date(at).toISOString().slice(0, 10)}`;

/**
 * The cooldown key for a sender.
 *
 * Keyed on a hash rather than the address itself. An IP address is personal
 * data and this is a photography site's spam guard — there is no reason for
 * the store to hold one, and a hash answers the only question being asked
 * ("has this sender just written?") exactly as well. `salt` is the sending
 * day, so yesterday's hashes cannot be looked up against today's and the keys
 * fall out of use on their own.
 */
export const cooldownKey = (hash: string): string => `cool:${hash}`;

/* ── what the form may send ───────────────────────────────────────
 * The same rules the form already applied, moved here so the route and the
 * action cannot drift apart, and so they can be tested.
 * ─────────────────────────────────────────────────────────────── */

export const SHOOT_TYPES = [
  "editorial",
  "campaign",
  "music",
  "session",
  "other",
] as const;

export const MAX = {
  name: 100,
  email: 200,
  detail: 200,
  message: 5000,
} as const;

/** Deliberately loose — the only thing worth rejecting is what cannot be an address. */
export const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

/**
 * Whether a sender may write, and if not, how long they have to wait.
 *
 * `wrote` is the timestamp KV has for them, or null for a sender it has never
 * seen. Returns whole seconds because that is what the form says out loud,
 * and rounds up so "1 second" never reads as "0".
 */
export function cooldown(
  wrote: number | null,
  now: number,
): { ok: true } | { ok: false; waitSeconds: number } {
  if (wrote === null) return { ok: true };

  const elapsed = now - wrote;
  // A clock that went backwards, or an entry from the future: treat it as
  // fresh rather than locking the sender out for as long as the skew lasts.
  if (elapsed < 0) return { ok: true };
  if (elapsed >= COOLDOWN_MS) return { ok: true };

  return {
    ok: false,
    waitSeconds: Math.max(1, Math.ceil((COOLDOWN_MS - elapsed) / 1000)),
  };
}

/** "5 minutes", "90 seconds" — how the wait is said to a person. */
export function waitPhrase(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** Field name → problem. Empty when the enquiry is sendable. */
export function problems(values: {
  name: string;
  email: string;
  message: string;
}): Record<string, string> {
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

  return errors;
}

/**
 * The enquiry as it will be stored, with everything trimmed to a known size.
 *
 * The caps are applied here rather than only checked, because a message is
 * written into a store with a quota: a field that passed validation by one
 * character and a field cut to the limit are both fine, whereas a field that
 * skipped validation is not, and this is the last place before the write.
 */
export function enquiry(
  values: {
    type: string;
    name: string;
    email: string;
    detail: string;
    message: string;
  },
  at: number,
  id: string,
  country?: string,
): Enquiry {
  return {
    id,
    at: new Date(at).toISOString(),
    type: (SHOOT_TYPES as readonly string[]).includes(values.type)
      ? values.type
      : "other",
    name: values.name.slice(0, MAX.name),
    email: values.email.slice(0, MAX.email),
    detail: values.detail.slice(0, MAX.detail),
    message: values.message.slice(0, MAX.message),
    read: false,
    ...(country ? { country } : {}),
  };
}

/* ── listing without reading ───────────────────────────────────────
 * KV can carry a little metadata alongside each value and hands it back with
 * the key list, so the summary a list needs — who, when, what kind, read or
 * not — costs one request for the whole inbox instead of one request per
 * message. The message body stays in the value and is fetched when a row is
 * opened, which is the only time anybody needs it.
 *
 * The free plan allows a hundred thousand reads a day and this is not close
 * to either shape of that. It is about the page opening at once rather than
 * in fifty stages.
 * ─────────────────────────────────────────────────────────────── */

/** What a row in the inbox shows before it is opened. */
export type Summary = {
  id: string;
  at: string;
  type: string;
  name: string;
  email: string;
  read: boolean;
  country?: string;
};

export const summary = (e: Enquiry): Summary => ({
  id: e.id,
  at: e.at,
  type: e.type,
  name: e.name,
  email: e.email,
  read: e.read,
  ...(e.country ? { country: e.country } : {}),
});

/**
 * A subject and body for replying by hand, from /admin.
 *
 * The inbox is where enquiries arrive; answering one still happens in his own
 * mail, where his signature and his sent folder are.
 */
export function replyLink(e: Enquiry): string {
  const subject = `Re: your ${e.type} enquiry`;
  const quoted = e.message
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  const body = `Hi ${e.name.split(" ")[0]},\n\n\n\nOn ${e.at.slice(0, 10)} you wrote:\n${quoted}\n`;
  return `mailto:${encodeURIComponent(e.email)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}
