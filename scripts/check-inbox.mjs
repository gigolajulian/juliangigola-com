/**
 * The inbox: keys, the cooldown, and what gets stored.
 *
 * Runs the real `lib/inbox.ts`, which is dependency-free for exactly this
 * reason. What it cannot cover is the KV binding itself — that needs a Worker
 * — so the split is deliberate: every decision lives in the module under test
 * and the action does nothing but read the form, ask this, and write.
 *
 * The spam guard is the reason this file exists. A cooldown that is wrong by a
 * sign, or a key that sorts the wrong way, is not something you notice until
 * somebody's script has spent the day's write quota.
 *
 *   node --experimental-strip-types scripts/check-inbox.mjs
 */

import assert from "node:assert/strict";
import {
  COOLDOWN_MS,
  DAILY_CAP,
  cooldown,
  cooldownKey,
  dayKey,
  enquiry,
  enquiryKey,
  looksLikeEmail,
  problems,
  replyLink,
  summary,
  waitPhrase,
  MAX,
} from "../lib/inbox.ts";

let n = 0;
const ok = (cond, what) => {
  assert.ok(cond, what);
  n++;
};
const eq = (a, b, what) => {
  assert.deepEqual(a, b, what);
  n++;
};

/* ── the cooldown ─────────────────────────────────────────────── */
{
  const now = 1_800_000_000_000;

  ok(cooldown(null, now).ok, "a sender nobody has seen may write");
  ok(!cooldown(now, now).ok, "a sender who just wrote may not");
  ok(
    cooldown(now - COOLDOWN_MS, now).ok,
    "exactly five minutes later, they may",
  );
  ok(
    cooldown(now - COOLDOWN_MS - 1, now).ok,
    "and any time after that",
  );
  ok(!cooldown(now - COOLDOWN_MS + 1000, now).ok, "a second short, they wait");

  // The wait it reports is the wait that is left, and it is never zero — "you
  // can write again in 0 seconds" is a refusal that reads like a bug.
  const gate = cooldown(now - 60_000, now);
  eq(gate.ok, false, "a minute in is still inside the window");
  eq(gate.waitSeconds, 240, "four minutes left of five");
  ok(cooldown(now - COOLDOWN_MS + 1, now).waitSeconds >= 1, "never zero");

  // A clock that disagrees with itself must not lock anybody out. Cloudflare
  // timestamps come from the edge and an entry written a moment ago can carry
  // a time in the future.
  ok(cooldown(now + 60_000, now).ok, "a timestamp from the future is not a wait");
}

/* ── how the wait is said ─────────────────────────────────────── */
{
  eq(waitPhrase(1), "1 second", "singular");
  eq(waitPhrase(45), "45 seconds", "plural");
  eq(waitPhrase(60), "1 minute", "the boundary reads as minutes");
  eq(waitPhrase(240), "4 minutes", "and rounds up rather than down");
  eq(waitPhrase(241), "5 minutes", "so the wait is never understated");
}

/* ── keys ─────────────────────────────────────────────────────── */
{
  // KV lists lexicographically, and the inbox is read newest first. If a
  // shorter number could sort above a longer one the order would be wrong the
  // moment the clock rolled a digit.
  const early = enquiryKey(999_999_999_999, "aaaa");
  const later = enquiryKey(1_800_000_000_000, "aaaa");
  ok(early < later, "an older enquiry sorts below a newer one");
  ok(enquiryKey(1, "a") < enquiryKey(2, "a"), "and at the small end too");
  ok(later.startsWith("msg:"), "the prefix is what the list filters on");

  eq(
    dayKey(Date.UTC(2026, 8, 12, 23, 59)),
    "count:2026-09-12",
    "the counter is bucketed by UTC day",
  );
  assert.notEqual(
    dayKey(Date.UTC(2026, 8, 12, 23, 59)),
    dayKey(Date.UTC(2026, 8, 13, 0, 1)),
    "and rolls over at midnight",
  );
  n++;

  ok(cooldownKey("abc").startsWith("cool:"), "cooldowns have their own prefix");
  ok(
    !cooldownKey("abc").startsWith("msg:"),
    "so they can never be listed as enquiries",
  );
}

/* ── what the form may send ───────────────────────────────────── */
{
  eq(problems({ name: "A", email: "a@b.co", message: "hi" }), {}, "a real one");

  ok(problems({ name: "", email: "a@b.co", message: "hi" }).name, "name needed");
  ok(
    problems({ name: "A", email: "nope", message: "hi" }).email,
    "an address that cannot be one is refused",
  );
  ok(
    problems({ name: "A", email: "a@b.co", message: "" }).message,
    "and a message is the point",
  );
  ok(
    problems({ name: "x".repeat(MAX.name + 1), email: "a@b.co", message: "hi" })
      .name,
    "a name past the cap is refused rather than cut",
  );

  ok(looksLikeEmail("j@example.com"), "ordinary address");
  ok(!looksLikeEmail("j@example"), "no dot, no address");
  ok(!looksLikeEmail("two words@example.com"), "no spaces");
}

/* ── what gets stored ─────────────────────────────────────────── */
{
  const at = Date.UTC(2026, 8, 12, 20, 30);
  const e = enquiry(
    {
      type: "editorial",
      name: "  ",
      email: "j@example.com",
      detail: "d",
      message: "m",
    },
    at,
    "id-1",
    "US",
  );

  eq(e.at, "2026-09-12T20:30:00.000Z", "the time is stored as UTC");
  eq(e.read, false, "and it arrives unread");
  eq(e.country, "US", "the country travels");
  eq(e.type, "editorial", "a known kind is kept");

  // An unknown kind becomes "other" rather than being stored as whatever was
  // posted: this string is rendered, and the form is a public endpoint.
  eq(
    enquiry({ type: "<script>", name: "n", email: "e", detail: "", message: "m" }, at, "x").type,
    "other",
    "an unknown kind is not stored as sent",
  );

  // The caps are applied, not only checked. This is the last place before a
  // store with a quota.
  const long = enquiry(
    {
      type: "other",
      name: "n",
      email: "e",
      detail: "x".repeat(500),
      message: "y".repeat(9000),
    },
    at,
    "x",
  );
  eq(long.detail.length, MAX.detail, "detail is cut to the cap");
  eq(long.message.length, MAX.message, "and so is the message");

  // No country given — the field is absent rather than present and empty, so
  // the row does not print a stray separator.
  ok(
    !("country" in enquiry({ type: "other", name: "n", email: "e", detail: "", message: "m" }, at, "x")),
    "no country, no key",
  );
}

/* ── the summary the list reads ───────────────────────────────── */
{
  const e = enquiry(
    { type: "music", name: "N", email: "e@x.co", detail: "d", message: "the message" },
    Date.now(),
    "id",
    "GB",
  );
  const s = summary(e);

  eq(s.name, "N", "who");
  eq(s.read, false, "and whether it has been read");
  ok(
    !("message" in s) && !("detail" in s),
    "the message itself stays out of the metadata — it is the one thing the list does not show, and KV caps metadata at 1KB",
  );
}

/* ── replying ─────────────────────────────────────────────────── */
{
  const e = enquiry(
    {
      type: "editorial",
      name: "Ada Lovelace",
      email: "ada@example.com",
      detail: "",
      message: "Two lines\nof message",
    },
    Date.UTC(2026, 8, 12),
    "id",
  );
  const link = replyLink(e);

  ok(link.startsWith("mailto:ada%40example.com?"), "addressed to the sender");
  ok(link.includes("Re%3A%20your%20editorial%20enquiry"), "with a subject");
  ok(link.includes("Hi%20Ada"), "and their first name");
  ok(link.includes("%3E%20Two%20lines"), "their words quoted back");
}

/* ── the ceiling ──────────────────────────────────────────────── */
{
  // Two writes per enquiry against the free plan's thousand a day, so the cap
  // has to leave room. If this ever rises above 400 the quota is the thing
  // that breaks, and it breaks by refusing the write rather than by saying so.
  ok(DAILY_CAP * 2 < 1000, "the cap cannot exhaust the day's writes");
  ok(DAILY_CAP >= 100, "and is nowhere near real traffic");
}

console.log(`inbox: ${n} cases pass`);
